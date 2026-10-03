/**
 * Keyset (seek) pagination + prefix full-text search helpers shared by every
 * paginated list endpoint.
 *
 * A list declares its sort keys (ending in a unique column so order is
 * total), e.g. [['created_at', 'timestamp'], ['id', 'int']], and one sort
 * direction for all of them (DESC by default, i.e. newest first). Pages
 * seek off the boundary row's key values instead of using OFFSET, and no
 * COUNT(*) is run, so every page costs the same regardless of depth.
 *
 * Cursors are opaque base64url JSON arrays of the key values as text. Values
 * are read back from Postgres as text (see KEY_TYPES) because JS Dates drop
 * microseconds, which would make the row comparison skip/repeat rows.
 */

const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const KEY_TYPES = {
  timestamp: {
    select: (col) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    cast: 'timestamptz',
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/,
  },
  date: {
    select: (col) => `to_char(${col}, 'YYYY-MM-DD')`,
    cast: 'date',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
  },
  int: {
    select: (col) => `${col}::text`,
    cast: 'bigint',
    pattern: /^\d{1,19}$/,
  },
  // Compared with the column's collation, same as ORDER BY, so seek and sort agree.
  text: {
    select: (col) => `${col}::text`,
    cast: 'text',
    pattern: /^[\s\S]{0,1000}$/,
  },
};

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

const encodeCursor = (values) => Buffer.from(JSON.stringify(values)).toString('base64url');

/** @returns {string[]} key values as text @throws 400 on malformed cursor */
const decodeCursor = (cursor, keys) => {
  let values;
  try {
    values = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
  } catch (_) { /* handled below */ }
  const ok = Array.isArray(values)
    && values.length === keys.length
    && keys.every(([, type], i) => typeof values[i] === 'string' && KEY_TYPES[type].pattern.test(values[i]));
  if (!ok) throw badRequest('Invalid cursor');
  return values;
};

/**
 * Validate and normalise keyset query params from req.query.
 * @returns {{cursor?: string, direction: 'next'|'prev', limit: number}}
 */
const parseKeysetQuery = (query = {}, { defaultLimit = 20, maxLimit = 500 } = {}) => {
  const { cursor, direction = 'next' } = query;
  if (!['next', 'prev'].includes(direction)) throw badRequest("direction must be 'next' or 'prev'");
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { cursor: cursor || undefined, direction, limit };
};

/** Shape of the `pagination` object every keyset list endpoint returns. */
const toPaginationDto = ({ limit, hasNext, hasPrev, nextCursor, prevCursor }) =>
  ({ limit, hasNext, hasPrev, nextCursor, prevCursor });

/**
 * Run a keyset-paginated findAll. Every key sorts in the same direction
 * (`order`), which is what lets the seek be a single row comparison.
 *
 * @param {import('sequelize').ModelStatic<any>} Model
 * @param {object}   opts
 * @param {Array<[string, keyof KEY_TYPES]>} opts.keys  DB column + type, last must be unique
 * @param {string}   [opts.cursor]
 * @param {'next'|'prev'} [opts.direction='next']
 * @param {'ASC'|'DESC'} [opts.order='DESC']  sort direction of the list
 * @param {number}   opts.limit
 * @param {object}   [opts.where]  any Sequelize where; ANDed with the seek predicate
 * @param {...any}   findOptions   passed through to findAll (include, etc.)
 * @returns {Promise<{rows: any[], limit: number, hasNext: boolean, hasPrev: boolean,
 *   nextCursor: string|null, prevCursor: string|null}>}
 */
const paginateKeyset = async (Model, { keys, cursor, direction = 'next', order = 'DESC', limit, where = {}, ...findOptions }) => {
  const isPrev = direction === 'prev';
  const isAsc = order === 'ASC';
  const qualified = keys.map(([col]) => `"${Model.name}"."${col}"`);
  const conditions = [where];

  if (cursor) {
    const values = decodeCursor(cursor, keys);
    const casted = values.map((v, i) => `${sequelize.escape(v)}::${KEY_TYPES[keys[i][1]].cast}`);
    // 'next' moves along the sort order, 'prev' against it.
    const op = isPrev === isAsc ? '<' : '>';
    conditions.push(Sequelize.literal(`(${qualified.join(', ')}) ${op} (${casted.join(', ')})`));
  }

  // Walk 'prev' in reverse order, then flip the rows back.
  const sortDir = isPrev === isAsc ? 'DESC' : 'ASC';
  const rows = await Model.findAll({
    ...findOptions,
    where: { [Op.and]: conditions },
    attributes: {
      include: keys.map(([, type], i) => [Sequelize.literal(KEY_TYPES[type].select(qualified[i])), `_k${i}`]),
    },
    order: keys.map(([col]) => [col, sortDir]),
    limit: limit + 1, // one extra row tells us if there's another page
  });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  if (isPrev) rows.reverse();

  // Coming from a cursor means the opposite direction has rows by definition.
  const hasNext = isPrev ? Boolean(cursor) : hasMore;
  const hasPrev = isPrev ? hasMore : Boolean(cursor);
  const toCursor = (row) => encodeCursor(keys.map((_, i) => row.get(`_k${i}`)));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const nextCursor = hasNext && last ? toCursor(last) : null;
  const prevCursor = hasPrev && first ? toCursor(first) : null;

  // Drop the helper columns so they never leak into serialized rows.
  for (const row of rows) keys.forEach((_, i) => delete row.dataValues[`_k${i}`]);

  return { rows, limit, hasNext, hasPrev, nextCursor, prevCursor };
};

/**
 * Build a tsquery SQL expression for "every word is a prefix of something".
 * Each word matches either the parser-normalised form (so "cl-3f2" or "o'brien"
 * hit their split lexemes) or the raw lexeme (so "jane.doe@te" prefix-matches
 * the single email lexeme). Words are ANDed. Values go through sequelize.escape.
 *
 * @returns {string|null} SQL, or null when the search has no usable words
 */
const buildPrefixTsQuery = (search) => {
  const words = String(search || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/\\/g, ''))
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length) return null;

  return words
    .map((w) => {
      const parsed = sequelize.escape(`'${w.replace(/'/g, "''")}':*`);
      const raw = sequelize.escape(`'${w.replace(/'/g, '')}':*`);
      return `(to_tsquery('simple', ${parsed}) || ${raw}::tsquery)`;
    })
    .join(' && ');
};

module.exports = { paginateKeyset, parseKeysetQuery, toPaginationDto, buildPrefixTsQuery };

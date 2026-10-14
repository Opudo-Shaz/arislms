/**
 * Full-text search documents, one per searchable table.
 *
 */

const col = (alias, name) => (alias ? `"${alias}"."${name}"` : name);

const clientSearchVector = (alias) => `to_tsvector('simple', coalesce(${col(alias, 'first_name')}, '') || ' ' || coalesce(${col(alias, 'last_name')}, '') || ' ' || coalesce(${col(alias, 'account_number')}, '') || ' ' || coalesce(${col(alias, 'id_document_number')}, '') || ' ' || coalesce(${col(alias, 'email')}, '') || ' ' || coalesce(${col(alias, 'phone')}, ''))`;

const loanSearchVector = (alias) => `to_tsvector('simple', coalesce(${col(alias, 'reference_code')}, ''))`;

const contributionSearchVector = (alias) => `to_tsvector('simple', coalesce(${col(alias, 'notes')}, ''))`;

// Key twice: as-is (so "storage.pr" prefix-matches) and with . and _ split into
// words (so "provider" finds "storage.provider"). Secret values are encrypted
// ciphertext, so they're left out rather than matching on "enc…" noise.
const systemConfigSearchVector = (alias) => `to_tsvector('simple', ${col(alias, 'key')} || ' ' || translate(${col(alias, 'key')}, '._', '  ') || ' ' || ${col(alias, 'label')} || ' ' || coalesce(${col(alias, 'description')}, '') || ' ' || CASE WHEN ${col(alias, 'is_secret')} THEN '' ELSE coalesce(${col(alias, 'value')}, '') END)`;

/** SQL predicate: `<clientIdColumn>` belongs to a client matching tsQuery (uses the clients GIN index). */
const clientIdMatches = (clientIdColumn, tsQuery) =>
  `${clientIdColumn} IN (SELECT id FROM clients WHERE ${clientSearchVector()} @@ (${tsQuery}))`;

module.exports = { clientSearchVector, loanSearchVector, contributionSearchVector, systemConfigSearchVector, clientIdMatches };

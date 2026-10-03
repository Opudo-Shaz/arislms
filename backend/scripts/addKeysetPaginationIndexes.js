/**
 * Migration: indexes backing keyset pagination + full-text search on list endpoints.
 * - Btree on each list's sort keys: seek predicate + ORDER BY.
 * - GIN on each search vector (constants/searchVectors.js). Expression indexes,
 *   not generated columns, because sequelize.sync({ alter: true }) drops
 *   columns that aren't on the model.
 *
 * Built with CREATE INDEX CONCURRENTLY so live tables keep accepting writes.
 * A failed concurrent build leaves an INVALID index that IF NOT EXISTS would
 * skip forever, so invalid ones are dropped and rebuilt.
 *
 * Idempotent; registered in utils/seederRegistry.js so it can be run via the API.
 * Standalone: node scripts/addKeysetPaginationIndexes.js
 */

const sequelize = require('../config/sequalize_db');
const {
  clientSearchVector, loanSearchVector, contributionSearchVector, systemConfigSearchVector,
} = require('../constants/searchVectors');

const INDEXES = [
  ['clients_created_at_id_idx', 'clients (created_at DESC, id DESC)'],
  ['clients_search_vector_idx', `clients USING GIN ((${clientSearchVector()}))`],
  ['loans_created_at_id_idx', 'loans (created_at DESC, id DESC)'],
  ['loans_search_vector_idx', `loans USING GIN ((${loanSearchVector()}))`],
  ['payments_created_at_id_idx', 'payments (created_at DESC, id DESC)'],
  ['member_contributions_date_id_idx', 'member_contributions (contribution_date DESC, id DESC)'],
  ['member_contributions_search_vector_idx', `member_contributions USING GIN ((${contributionSearchVector()}))`],
  ['journal_entries_entry_date_id_idx', 'journal_entries (entry_date DESC, id DESC)'],
  ['notification_outbox_created_at_id_idx', 'notification_outbox (created_at DESC, id DESC)'],
  ['audit_logs_occurred_at_id_idx', 'audit_logs (occurred_at DESC, audit_id DESC)'],
  ['system_configs_category_label_id_idx', 'system_configs (category, label, id)'],
  ['system_configs_search_vector_idx', `system_configs USING GIN ((${systemConfigSearchVector()}))`],
];

/** @returns {Promise<{created: string[], rebuilt: string[], skipped: string[]}>} */
async function addKeysetPaginationIndexes() {
  const created = [];
  const rebuilt = [];
  const skipped = [];

  for (const [name, definition] of INDEXES) {
    const [existing] = await sequelize.query(
      `SELECT i.indisvalid AS valid
         FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = :name AND c.relkind = 'i'`,
      { replacements: { name }, type: sequelize.QueryTypes.SELECT }
    );

    if (existing?.valid) {
      skipped.push(name);
      continue;
    }
    if (existing) {
      await sequelize.query(`DROP INDEX CONCURRENTLY IF EXISTS ${name};`);
    }

    await sequelize.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${definition};`);
    (existing ? rebuilt : created).push(name);
  }

  return { created, rebuilt, skipped };
}

module.exports = addKeysetPaginationIndexes;

// Allow standalone execution: node backend/scripts/addKeysetPaginationIndexes.js
if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      const summary = await addKeysetPaginationIndexes();
      console.log('Migration complete:', JSON.stringify(summary, null, 2));
      await sequelize.close();
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  })();
}

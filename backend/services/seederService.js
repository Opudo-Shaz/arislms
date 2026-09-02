const seederRegistry = require('../utils/seederRegistry');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

/** List all registered seeders (metadata only). */
function listSeeders() {
  return seederRegistry.list();
}

/**
 * Runs a registered seeder by key. Never throws for a bad/unknown key —
 * throws an error with `.code = 'NOT_FOUND'` instead so the controller can
 * map it to a 404.
 * @param {string} key
 * @param {number} actorId - id of the Super Admin triggering the run (for audit)
 */
async function runSeeder(key, actorId) {
  const seeder = seederRegistry.get(key);
  if (!seeder) {
    const err = new Error(`Seeder "${key}" not found`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  const startedAt = new Date();
  try {
    const summary = await seeder.fn();
    const finishedAt = new Date();

    await AuditLogger.log({
      entityType: 'SEEDER',
      entityId: key,
      action: 'SEED',
      data: { key, name: seeder.name, summary, durationMs: finishedAt - startedAt },
      actorId,
      options: { actorType: 'USER', source: 'seederController' },
    });

    return { key, name: seeder.name, status: 'success', startedAt, finishedAt, summary: summary || null };
  } catch (err) {
    logger.error(`[seederService] Seeder "${key}" failed: ${err.message}`);
    await AuditLogger.log({
      entityType: 'SEEDER',
      entityId: key,
      action: 'SEED',
      data: { key, name: seeder.name, error: err.message },
      actorId,
      options: { actorType: 'USER', source: 'seederController' },
    });
    throw err;
  }
}

module.exports = { listSeeders, runSeeder };

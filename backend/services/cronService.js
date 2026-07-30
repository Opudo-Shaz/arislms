const cronRegistry = require('../utils/cronRegistry')
const CronJobRun = require('../models/cronJobRunModel')
const User = require('../models/userModel')
const logger = require('../config/logger')

/**
 * cronService
 *
 * Query/command API over the cron registry for the admin UI:
 *   - list jobs with metadata + last run
 *   - list a job's run history (with the triggering user's name)
 *   - manually run a job
 */

function runToDto(row) {
  if (!row) return null
  const user = row.triggeredByUser
  return {
    id: row.id,
    jobKey: row.jobKey,
    status: row.status,
    triggeredBy: row.triggeredBy,
    triggeredById: row.triggeredById,
    triggeredByName: user
      ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
      : null,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    summary: row.summary,
    error: row.error,
  }
}

async function listJobs() {
  return cronRegistry.list()
}

async function listRuns(jobKey, { limit = 20 } = {}) {
  if (!cronRegistry.has(jobKey)) {
    const err = new Error(`Cron job "${jobKey}" not found`)
    err.code = 'NOT_FOUND'
    throw err
  }
  const rows = await CronJobRun.findAll({
    where: { jobKey },
    include: [
      { model: User, as: 'triggeredByUser', attributes: ['id', 'first_name', 'last_name', 'email'], required: false },
    ],
    order: [['started_at', 'DESC']],
    limit,
  })
  return rows.map(runToDto)
}

async function runJob(jobKey, { triggeredById = null } = {}) {
  logger.info(`[CronService] Manual run of "${jobKey}" requested by user ${triggeredById ?? 'unknown'}`)
  return cronRegistry.trigger(jobKey, { triggeredBy: 'USER', triggeredById })
}

module.exports = { listJobs, listRuns, runJob }

/**
 * cronRegistry
 *
 * Central registry + execution engine for scheduled background jobs.
 *
 * Instead of calling `cron.schedule` directly, jobs register here. The registry:
 *   - schedules the job via node-cron,
 *   - wraps every run (scheduled OR manual) with a concurrency lock so the same
 *     job never runs twice at once,
 *   - persists each run to `cron_job_runs` (status, duration, summary, error),
 *   - exposes metadata + last-run info for the admin UI, and
 *   - allows an admin to trigger a run on demand.
 *
 * This gives the frontend full visibility of cron jobs and safe manual runs.
 */

const cron = require('node-cron')
const logger = require('../config/logger')
const CronJobRun = require('../models/cronJobRunModel')

// key -> { key, name, description, schedule, scheduleLabel, timezone, handler, task, isRunning, lastRun }
const jobs = new Map()

/**
 * Execute a job with locking + run persistence. Shared by scheduler and manual triggers.
 * @param {object} job - registry entry
 * @param {{triggeredBy:'SYSTEM'|'USER', triggeredById:?number}} trigger
 * @returns {Promise<object>} the run result ({ status, startedAt, finishedAt, durationMs, summary|error, triggeredBy })
 */
async function execute(job, { triggeredBy, triggeredById = null }) {
  if (job.isRunning) {
    const err = new Error(`Cron job "${job.key}" is already running`)
    err.code = 'ALREADY_RUNNING'
    throw err
  }

  job.isRunning = true
  const startedAt = new Date()

  // Persist a "running" row up front (best-effort — never block the actual work).
  let runRow = null
  try {
    runRow = await CronJobRun.create({
      jobKey: job.key,
      status: 'running',
      triggeredBy,
      triggeredById,
      startedAt,
    })
  } catch (e) {
    logger.error(`[CronRegistry] Failed to persist run start for "${job.key}": ${e.message}`)
  }

  try {
    const summary = await job.handler()
    const finishedAt = new Date()
    const durationMs = finishedAt - startedAt

    job.lastRun = { status: 'success', startedAt, finishedAt, durationMs, summary, triggeredBy, triggeredById }
    if (runRow) {
      try {
        await runRow.update({ status: 'success', finishedAt, durationMs, summary })
      } catch (e) {
        logger.error(`[CronRegistry] Failed to persist run result for "${job.key}": ${e.message}`)
      }
    }
    return job.lastRun
  } catch (err) {
    const finishedAt = new Date()
    const durationMs = finishedAt - startedAt

    job.lastRun = { status: 'failed', startedAt, finishedAt, durationMs, error: err.message, triggeredBy, triggeredById }
    if (runRow) {
      try {
        await runRow.update({ status: 'failed', finishedAt, durationMs, error: err.message })
      } catch (e) {
        logger.error(`[CronRegistry] Failed to persist run error for "${job.key}": ${e.message}`)
      }
    }
    throw err
  } finally {
    job.isRunning = false
  }
}

/**
 * Register (and schedule) a job. Call once at startup per job.
 * @param {object} cfg
 * @param {string} cfg.key - stable unique id (e.g. 'loan-status')
 * @param {string} cfg.name - human-readable name
 * @param {string} [cfg.description]
 * @param {string} cfg.schedule - cron expression (e.g. '0 1 * * *')
 * @param {string} [cfg.scheduleLabel] - human-readable schedule (e.g. 'Daily at 01:00')
 * @param {string} [cfg.timezone]
 * @param {Function} cfg.handler - async fn returning a JSON-serialisable summary
 */
function register({ key, name, description = '', schedule, scheduleLabel = '', timezone, handler }) {
  if (!key || !schedule || typeof handler !== 'function') {
    throw new Error('cronRegistry.register requires { key, schedule, handler }')
  }
  if (jobs.has(key)) {
    throw new Error(`Cron job "${key}" is already registered`)
  }

  const job = {
    key,
    name: name || key,
    description,
    schedule,
    scheduleLabel,
    timezone,
    handler,
    task: null,
    isRunning: false,
    lastRun: null,
  }

  const task = cron.schedule(
    schedule,
    () => {
      execute(job, { triggeredBy: 'SYSTEM', triggeredById: null }).catch((err) =>
        logger.error(`[CronRegistry] Scheduled run of "${key}" failed: ${err.message}`),
      )
    },
    { timezone },
  )

  job.task = task
  jobs.set(key, job)
  logger.info(`[CronRegistry] Registered "${key}" — ${schedule}${timezone ? ` (${timezone})` : ''}`)
  return job
}

/** Serialise the public shape of a job (no handler/task). */
function toPublic(job, lastRun) {
  return {
    key: job.key,
    name: job.name,
    description: job.description,
    schedule: job.schedule,
    scheduleLabel: job.scheduleLabel,
    timezone: job.timezone || null,
    isRunning: job.isRunning,
    lastRun: lastRun ?? job.lastRun ?? null,
  }
}

/**
 * List all registered jobs with their last run. Falls back to the persisted
 * last run (survives restarts) when nothing has run this process yet.
 */
async function list() {
  const result = []
  for (const job of jobs.values()) {
    let lastRun = job.lastRun
    if (!lastRun) {
      try {
        const row = await CronJobRun.findOne({
          where: { jobKey: job.key },
          order: [['started_at', 'DESC']],
        })
        if (row) {
          lastRun = {
            status: row.status,
            startedAt: row.startedAt,
            finishedAt: row.finishedAt,
            durationMs: row.durationMs,
            summary: row.summary,
            error: row.error,
            triggeredBy: row.triggeredBy,
            triggeredById: row.triggeredById,
          }
        }
      } catch (e) {
        logger.error(`[CronRegistry] Failed to load last run for "${job.key}": ${e.message}`)
      }
    }
    result.push(toPublic(job, lastRun))
  }
  return result
}

/** True if a job with this key is registered. */
function has(key) {
  return jobs.has(key)
}

/**
 * Manually trigger a job.
 * @param {string} key
 * @param {{triggeredBy?:'USER'|'SYSTEM', triggeredById?:?number}} [opts]
 */
async function trigger(key, { triggeredBy = 'USER', triggeredById = null } = {}) {
  const job = jobs.get(key)
  if (!job) {
    const err = new Error(`Cron job "${key}" not found`)
    err.code = 'NOT_FOUND'
    throw err
  }
  return execute(job, { triggeredBy, triggeredById })
}

/** Recent run history for a job (newest first). */
async function getRuns(key, { limit = 20 } = {}) {
  if (!jobs.has(key)) {
    const err = new Error(`Cron job "${key}" not found`)
    err.code = 'NOT_FOUND'
    throw err
  }
  return CronJobRun.findAll({
    where: { jobKey: key },
    order: [['started_at', 'DESC']],
    limit,
  })
}

module.exports = { register, list, has, trigger, getRuns }

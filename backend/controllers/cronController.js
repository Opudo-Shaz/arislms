const service = require('../services/cronService')
const logger = require('../config/logger')
const { getUserId } = require('../utils/helpers')

module.exports = {
  /** GET /api/cron-jobs — list registered jobs with metadata + last run. */
  async list(req, res) {
    try {
      const jobs = await service.listJobs()
      res.json({ success: true, data: jobs })
    } catch (err) {
      logger.error(`CronController.list: ${err.message}`)
      res.status(500).json({ success: false, message: 'Failed to fetch cron jobs' })
    }
  },

  /** GET /api/cron-jobs/:key/runs — recent run history for a job. */
  async runs(req, res) {
    try {
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 100) : 20
      const runs = await service.listRuns(req.params.key, { limit })
      res.json({ success: true, data: runs })
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ success: false, message: err.message })
      }
      logger.error(`CronController.runs: ${err.message}`)
      res.status(500).json({ success: false, message: 'Failed to fetch cron job runs' })
    }
  },

  /** POST /api/cron-jobs/:key/run — manually trigger a job (admin only). */
  async run(req, res) {
    try {
      const result = await service.runJob(req.params.key, { triggeredById: getUserId(req) })
      res.json({ success: true, data: result })
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ success: false, message: err.message })
      }
      if (err.code === 'ALREADY_RUNNING') {
        return res.status(409).json({ success: false, message: err.message })
      }
      logger.error(`CronController.run: ${err.message}`)
      res.status(500).json({ success: false, message: `Job failed: ${err.message}` })
    }
  },
}

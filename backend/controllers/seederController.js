const service = require('../services/seederService')
const logger = require('../config/logger')
const { getUserId } = require('../utils/helpers')

module.exports = {
  /** GET /api/seeders — list registered seed scripts (Super Admin only). */
  async list(req, res) {
    try {
      const seeders = service.listSeeders()
      res.json({ success: true, data: seeders })
    } catch (err) {
      logger.error(`SeederController.list: ${err.message}`)
      res.status(500).json({ success: false, message: 'Failed to fetch seeders' })
    }
  },

  /** POST /api/seeders/:key/run — manually run a seed script (Super Admin only). */
  async run(req, res) {
    try {
      const result = await service.runSeeder(req.params.key, getUserId(req))
      res.json({ success: true, data: result })
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ success: false, message: err.message })
      }
      logger.error(`SeederController.run: ${err.message}`)
      res.status(500).json({ success: false, message: `Seeder failed: ${err.message}` })
    }
  },
}

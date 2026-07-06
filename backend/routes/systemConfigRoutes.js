const express = require('express')
const controller = require('../controllers/systemConfigController')
const { authenticate, authorize } = require('../middleware/authMiddleware')

const router = express.Router()

// GET all — admin + manager can read
router.get('/', authenticate, authorize([1, 2]), controller.getAll)

// GET one
router.get('/:id', authenticate, authorize([1, 2]), controller.getOne)

// POST create — admin only
router.post('/', authenticate, authorize([1]), controller.create)

// PUT update value/label/category/description — admin only
router.put('/:id', authenticate, authorize([1]), controller.update)

// PATCH toggle isActive — admin only (inline table toggle)
router.patch('/:id/status', authenticate, authorize([1]), controller.toggleStatus)

// DELETE — admin only
router.delete('/:id', authenticate, authorize([1]), controller.remove)

module.exports = router

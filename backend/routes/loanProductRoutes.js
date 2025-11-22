const express = require('express');
const controller = require('../controllers/loanProductController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Only admin should manage loan products
router.post('/', authenticate, authorize(['admin']), controller.create);
router.get('/', authenticate, authorize(['admin']), controller.getAll);
router.get('/:id', authenticate, authorize(['admin']), controller.getOne);
router.put('/:id', authenticate, authorize(['admin']), controller.update);
router.delete('/:id', authenticate, authorize(['admin']), controller.delete);

module.exports = router;

const express = require('express');
const clientController = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// ✅ Only admin can create or manage clients
router.post('/', authenticate, authorize(['admin']), clientController.createClient);
router.get('/', authenticate, authorize(['admin']), clientController.getClients); 
router.get('/:id', authenticate, authorize(['admin']), clientController.getClient);
router.put('/:id', authenticate, authorize(['admin']), clientController.updateClient);
router.delete('/:id', authenticate, authorize(['admin']), clientController.deleteClient);

module.exports = router;

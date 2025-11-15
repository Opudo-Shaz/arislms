const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

//view all payments
router.get('/', authenticate, authorize(['admin']), paymentController.getAll);

// View all payments for a specific loan
router.get('/loan/:loanId', authenticate, paymentController.getByLoan);

// Record a new payment
router.post('/', authenticate, paymentController.create);

// Delete a payment
router.delete('/:id', authenticate, authorize(['admin']), paymentController.delete);

module.exports = router;

const express = require('express');
const { getLoans, getLoan, createLoan, updateLoan, deleteLoan } = require('../controllers/loanController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin can see all loans
router.get('/', authenticate, authorize(['admin']), getLoans);

// User can see their own loan
router.get('/:id', authenticate, getLoan);

// Admin or user can create new loan (depending on your logic)
router.post('/', authenticate, createLoan);

// Only admin can update loan status, etc.
router.put('/:id', authenticate, authorize(['admin']), updateLoan);

// Only admin can delete loan
router.delete('/:id', authenticate, authorize(['admin']), deleteLoan);

module.exports = router;

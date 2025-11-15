const express = require('express');
const {
  getAllLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
  getMyLoans
} = require('../controllers/loanController');

const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();


// Get all loans (Admin only)
router.get('/', authenticate, authorize(['admin']), getAllLoans);

// Get authenticated user's loans (User & Admin)
router.get('/my', authenticate, getMyLoans);

// Get single loan by ID (User can only access their own loan unless admin)
router.get('/:id', authenticate, getLoanById);

// Create a new loan (User or Admin)
router.post('/', authenticate, createLoan);

// Update loan (Admin only)
router.put('/:id', authenticate, authorize(['admin']), updateLoan);

// Delete loan (Admin only)
router.delete('/:id', authenticate, authorize(['admin']), deleteLoan);

module.exports = router;

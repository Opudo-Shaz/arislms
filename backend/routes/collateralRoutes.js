const express = require('express');
const collateralController = require('../controllers/collateralController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/collaterals/loan/{loanId}:
 *   get:
 *     summary: Get all collateral records for a loan (admin only)
 *     tags:
 *       - Collaterals
 */
router.get('/loan/:loanId', authenticate, collateralController.getByLoan);

/**
 * @openapi
 * /api/collaterals/{id}/status:
 *   patch:
 *     summary: Update collateral lifecycle status (admin only)
 *     tags:
 *       - Collaterals
 */
router.patch('/:id/status', authenticate, authorize([1, 2]), collateralController.updateStatus);

module.exports = router;
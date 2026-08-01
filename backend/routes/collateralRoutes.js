const express = require('express');
const collateralController = require('../controllers/collateralController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

const router = express.Router();

/**
 * @openapi
 * /api/collaterals/loan/{loanId}:
 *   get:
 *     summary: Get all collateral records for a loan (admin only)
 *     tags:
 *       - Collaterals
 */
router.get('/loan/:loanId', authenticate, validateIdParam('loanId'), collateralController.getByLoan);

/**
 * @openapi
 * /api/collaterals/{id}/status:
 *   patch:
 *     summary: Update collateral lifecycle status (admin only)
 *     tags:
 *       - Collaterals
 */
router.patch('/:id/status', authenticate, authorize([1, 2]), validateIdParam(), collateralController.updateStatus);
router.patch('/:id', authenticate, authorize([1]), validateIdParam(), collateralController.updateParticulars);

module.exports = router;
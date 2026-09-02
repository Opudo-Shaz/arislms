const express = require('express');
const collateralController = require('../controllers/collateralController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
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
router.patch('/:id/status', authenticate, requirePermission('collaterals:update_status'), validateIdParam(), collateralController.updateStatus);
router.patch('/:id', authenticate, requirePermission('collaterals:update'), validateIdParam(), collateralController.updateParticulars);

module.exports = router;
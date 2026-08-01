const express = require('express');
const router = express.Router();
const CodeController = require('../controllers/codeController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateIdParam } = require('../middleware/validateIdParam');

/**
 * @openapi
 * /api/codes:
 *   get:
 *     summary: Get all codes
 *     tags:
 *       - Codes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of codes
 *   post:
 *     summary: Create a new code (admin only)
 *     tags:
 *       - Codes
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, CodeController.getAllCodes);
router.post('/', authenticate, authorize([1]), CodeController.createCode);

/**
 * @openapi
 * /api/codes/{key}/validate:
 *   post:
 *     summary: Validate a value against a code's active values
 *     tags:
 *       - Codes
 *     security:
 *       - bearerAuth: []
 */
router.post('/:key/validate', authenticate, CodeController.validate);

// Lookup by key (e.g. GENDER) — includes values, used to populate dropdowns
router.get('/key/:key', authenticate, CodeController.getCodeByKey);

// Code values nested under a code
router.get('/:codeId/values', authenticate, validateIdParam('codeId'), CodeController.listCodeValues);
router.post('/:codeId/values', authenticate, authorize([1]), CodeController.createCodeValue);
router.put('/values/:valueId', authenticate, authorize([1]), validateIdParam('valueId'), CodeController.updateCodeValue);
router.delete('/values/:valueId', authenticate, authorize([1]), validateIdParam('valueId'), CodeController.deleteCodeValue);

// Code CRUD by id
router.get('/:id', authenticate, validateIdParam(), CodeController.getCodeById);
router.put('/:id', authenticate, authorize([1]), validateIdParam(), CodeController.updateCode);
router.delete('/:id', authenticate, authorize([1]), validateIdParam(), CodeController.deleteCode);

module.exports = router;

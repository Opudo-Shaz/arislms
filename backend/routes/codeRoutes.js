const express = require('express');
const router = express.Router();
const CodeController = require('../controllers/codeController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
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
router.post('/', authenticate, requirePermission('codes:create'), CodeController.createCode);

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
router.post('/:codeId/values', authenticate, requirePermission('codes:create'), CodeController.createCodeValue);
router.put('/values/:valueId', authenticate, requirePermission('codes:update'), validateIdParam('valueId'), CodeController.updateCodeValue);
router.delete('/values/:valueId', authenticate, requirePermission('codes:delete'), validateIdParam('valueId'), CodeController.deleteCodeValue);

// Code CRUD by id
router.get('/:id', authenticate, validateIdParam(), CodeController.getCodeById);
router.put('/:id', authenticate, requirePermission('codes:update'), validateIdParam(), CodeController.updateCode);
router.delete('/:id', authenticate, requirePermission('codes:delete'), validateIdParam(), CodeController.deleteCode);

module.exports = router;

const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { authenticate, authorize } = require('../middleware/authMiddleware');


router.post('/', authenticate, authorize(['admin']), RoleController.createRole);
router.get('/', authenticate, RoleController.getAllRoles);
router.get('/:id', authenticate, RoleController.getRoleById);
router.put('/:id', authenticate, authorize(['admin']), RoleController.updateRole);
router.post('/:id/permissions', authenticate, authorize(['admin']), RoleController.addPermission);
router.delete('/:id/permissions', authenticate, authorize(['admin']), RoleController.removePermission);
router.delete('/:id', authenticate, authorize(['admin']), RoleController.deleteRole);

module.exports = router;

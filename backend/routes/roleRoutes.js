const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { authenticate, authorize } = require('../middleware/authMiddleware');


router.post('/', authenticate, authorize([1,2]), RoleController.createRole);
router.get('/', authenticate, RoleController.getAllRoles);
router.get('/:id', authenticate, RoleController.getRoleById);
router.put('/:id', authenticate, authorize([1,2]), RoleController.updateRole);
router.post('/:id/permissions', authenticate, authorize([1,2]), RoleController.addPermission);
router.delete('/:id/permissions', authenticate, authorize([1,2]), RoleController.removePermission);
router.delete('/:id', authenticate, authorize([1,2]), RoleController.deleteRole);

module.exports = router;

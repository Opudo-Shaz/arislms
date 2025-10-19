const express = require('express');
const { getUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, authorize(['admin']), getUsers);
router.get('/:id', authenticate, getUser);
router.post('/', authenticate, authorize(['admin']), createUser);
router.put('/:id', authenticate, authorize(['admin']), updateUser);
router.delete('/:id', authenticate, authorize(['admin']), deleteUser);

module.exports = router;

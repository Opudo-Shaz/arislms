const express = require('express');
const clientController = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/clients:
 *   post:
 *     summary: Create a new client (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Jane Doe
 *             email: jane@test.com
 *             phone: "+1234567890"
 *             address: "123 Main Street"
 *     responses:
 *       201:
 *         description: Client created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 5
 *               name: Jane Doe
 *               email: jane@test.com
 *               phone: "+1234567890"
 *               address: "123 Main Street"
 */
router.post('/', authenticate, authorize([1,2]), clientController.createClient);

/**
 * @openapi
 * /api/clients:
 *   get:
 *     summary: Get all clients (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of clients
 *         content:
 *           application/json:
 *             example:
 *               - id: 1
 *                 name: John Smith
 *                 email: john@test.com
 *                 phone: "+1234567890"
 *                 address: "456 Elm Street"
 *               - id: 2
 *                 name: Alice Johnson
 *                 email: alice@test.com
 *                 phone: "+9876543210"
 *                 address: "789 Oak Avenue"
 */
router.get('/', authenticate, authorize([1,2]), clientController.getClients);

/**
 * @openapi
 * /api/clients/{id}:
 *   get:
 *     summary: Get client by ID (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Client details
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               name: John Smith
 *               email: john@test.com
 *               phone: "+1234567890"
 *               address: "456 Elm Street"
 */
router.get('/:id', authenticate, authorize([1,2]), clientController.getClient);

/**
 * @openapi
 * /api/clients/{id}:
 *   put:
 *     summary: Update client (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Jane Doe Updated
 *             phone: "+1122334455"
 *     responses:
 *       200:
 *         description: Client updated successfully
 */
router.put('/:id', authenticate, authorize([1,2]), clientController.updateClient);

/**
 * @openapi
 * /api/clients/{id}:
 *   delete:
 *     summary: Delete client (admin only)
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     responses:
 *       200:
 *         description: Client deleted successfully
 */
router.delete('/:id', authenticate, authorize([1,2]), clientController.deleteClient);

module.exports = router;

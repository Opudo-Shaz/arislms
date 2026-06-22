const express = require('express');
const multer  = require('multer');
const documentController = require('../controllers/documentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Store uploaded files in memory so the service layer writes them to the
// configured storage provider (local / s3 / minio).
// Max 10 MB per file; allowed MIME types are validated at the route level.
const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error(`File type not allowed: ${file.mimetype}`), { statusCode: 400 }));
    }
  },
});

/**
 * @openapi
 * /api/documents:
 *   post:
 *     summary: Upload a document (KYC or collateral)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, documentType, documentCategory]
 *             properties:
 *               file:              { type: string, format: binary }
 *               documentType:      { type: string, example: national_id }
 *               documentCategory:  { type: string, example: client_kyc }
 *               clientId:          { type: integer }
 *               loanId:            { type: integer }
 *               collateralId:      { type: integer }
 *               description:       { type: string }
 *               expiresAt:         { type: string, format: date }
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 */
router.post('/', authenticate, authorize([1, 2]), upload.single('file'), documentController.uploadDocument);

/**
 * @openapi
 * /api/documents:
 *   get:
 *     summary: List documents (supports query filters)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema: { type: integer }
 *       - in: query
 *         name: loanId
 *         schema: { type: integer }
 *       - in: query
 *         name: collateralId
 *         schema: { type: integer }
 *       - in: query
 *         name: documentType
 *         schema: { type: string }
 *       - in: query
 *         name: documentCategory
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/', authenticate, authorize([1, 2, 3]), documentController.getDocuments);

/**
 * @openapi
 * /api/documents/client/{clientId}:
 *   get:
 *     summary: Get all documents for a client
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Client documents
 */
router.get('/client/:clientId', authenticate, authorize([1, 2, 3]), documentController.getDocumentsByClient);

/**
 * @openapi
 * /api/documents/loan/{loanId}:
 *   get:
 *     summary: Get all documents for a loan
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Loan documents
 */
router.get('/loan/:loanId', authenticate, authorize([1, 2, 3]), documentController.getDocumentsByLoan);

/**
 * @openapi
 * /api/documents/{id}:
 *   get:
 *     summary: Get a single document by ID
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Document record
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticate, authorize([1, 2, 3]), documentController.getDocument);

/**
 * @openapi
 * /api/documents/{id}:
 *   patch:
 *     summary: Update document metadata
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentType:     { type: string }
 *               documentCategory: { type: string }
 *               description:      { type: string }
 *               expiresAt:        { type: string, format: date }
 *               status:           { type: string }
 *     responses:
 *       200:
 *         description: Updated document
 */
router.patch('/:id', authenticate, authorize([1, 2]), documentController.updateDocument);

/**
 * @openapi
 * /api/documents/{id}:
 *   delete:
 *     summary: Soft-delete a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Document deleted
 */
router.delete('/:id', authenticate, authorize([1]), documentController.deleteDocument);

/**
 * @openapi
 * /api/documents/{id}/download:
 *   get:
 *     summary: Download / view a document file (requires authentication)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: File binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
router.get('/:id/download', authenticate, authorize([1, 2, 3]), documentController.downloadDocument);

module.exports = router;

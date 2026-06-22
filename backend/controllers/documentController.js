const documentService = require('../services/documentService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');

const documentController = {

  // POST /api/documents  (multipart/form-data)
  async uploadDocument(req, res) {
    try {
      const userId = getUserId(req);
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
      }

      const { documentType, documentCategory, clientId, loanId, collateralId, description, expiresAt } = req.body;

      if (!documentType || !documentCategory) {
        return res.status(400).json({ success: false, message: 'documentType and documentCategory are required' });
      }
      if (!clientId && !loanId && !collateralId) {
        return res.status(400).json({ success: false, message: 'At least one of clientId, loanId, or collateralId is required' });
      }

      logger.info(`User ${userId} uploading document [${documentCategory}/${documentType}]`);

      const doc = await documentService.uploadDocument(
        req.file,
        { documentType, documentCategory, clientId, loanId, collateralId, description, expiresAt },
        req.user,
        req.headers['user-agent']
      );

      return res.status(201).json({ success: true, message: 'Document uploaded successfully', data: doc });
    } catch (error) {
      logger.error(`Upload Document Error: ${error.message}`);
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  // GET /api/documents
  async getDocuments(req, res) {
    try {
      const userId = getUserId(req);
      logger.info(`User ${userId} fetching documents`);
      const docs = await documentService.getAllDocuments(req.query);
      return res.status(200).json({ success: true, data: docs });
    } catch (error) {
      logger.error(`Get Documents Error: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Unable to fetch documents' });
    }
  },

  // GET /api/documents/:id
  async getDocument(req, res) {
    try {
      const doc = await documentService.getDocumentById(req.params.id);
      return res.status(200).json({ success: true, data: doc });
    } catch (error) {
      logger.error(`Get Document Error: ${error.message}`);
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  // GET /api/documents/client/:clientId
  async getDocumentsByClient(req, res) {
    try {
      const docs = await documentService.getDocumentsByClient(req.params.clientId);
      return res.status(200).json({ success: true, data: docs });
    } catch (error) {
      logger.error(`Get Client Documents Error: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Unable to fetch client documents' });
    }
  },

  // GET /api/documents/loan/:loanId
  async getDocumentsByLoan(req, res) {
    try {
      const docs = await documentService.getDocumentsByLoan(req.params.loanId);
      return res.status(200).json({ success: true, data: docs });
    } catch (error) {
      logger.error(`Get Loan Documents Error: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Unable to fetch loan documents' });
    }
  },

  // PATCH /api/documents/:id
  async updateDocument(req, res) {
    try {
      const userId = getUserId(req);
      logger.info(`User ${userId} updating document ${req.params.id}`);
      const doc = await documentService.updateDocument(req.params.id, req.body, req.user, req.headers['user-agent']);
      return res.status(200).json({ success: true, message: 'Document updated', data: doc });
    } catch (error) {
      logger.error(`Update Document Error: ${error.message}`);
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  // DELETE /api/documents/:id
  async deleteDocument(req, res) {
    try {
      const userId = getUserId(req);
      logger.info(`User ${userId} deleting document ${req.params.id}`);
      await documentService.deleteDocument(req.params.id, req.user, req.headers['user-agent']);
      return res.status(200).json({ success: true, message: 'Document deleted' });
    } catch (error) {
      logger.error(`Delete Document Error: ${error.message}`);
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  // GET /api/documents/:id/download
  async downloadDocument(req, res) {
    try {
      const { filePath, mimeType, originalName } = await documentService.getDownloadInfo(req.params.id);
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
      return res.sendFile(filePath);
    } catch (error) {
      logger.error(`Download Document Error: ${error.message}`);
      return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },
};

module.exports = documentController;

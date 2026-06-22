const Document = require('../models/documentModel');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const { provider, providerName } = require('../utils/storage/storageFactory');
const DocumentStatus = require('../enums/documentStatus');

const documentService = {

  // ─── Upload (create) ──────────────────────────────────────────────────────

  /**
   * Persist a file and create a Document record.
   *
   * @param {object} file       - multer file object (buffer in memory)
   * @param {object} meta       - { documentType, documentCategory, clientId?, loanId?, collateralId?, description?, expiresAt? }
   * @param {object} actor      - req.user
   * @param {string} userAgent
   */
  async uploadDocument(file, meta, actor, userAgent = 'unknown') {
    const actorId = actor?.id || null;

    // Build a sub-path so files are grouped: <category>/<clientId|loanId>
    const folder = meta.clientId
      ? `${meta.documentCategory}/client_${meta.clientId}`
      : meta.loanId
        ? `${meta.documentCategory}/loan_${meta.loanId}`
        : meta.documentCategory;

    const { storedName, documentLink, fileSize, mimeType } = await provider.save(file, folder);

    const doc = await Document.create({
      documentType:     meta.documentType,
      documentCategory: meta.documentCategory,
      clientId:         meta.clientId     || null,
      loanId:           meta.loanId       || null,
      collateralId:     meta.collateralId || null,
      originalName:     file.originalname,
      storedName,
      documentLink:     null, // filled in below once we have the record ID
      mimeType,
      fileSize,
      storageProvider:  providerName,
      status:           DocumentStatus.ACTIVE,
      expiresAt:        meta.expiresAt    || null,
      description:      meta.description  || null,
      createdBy:        actorId,
      updatedBy:        actorId,
    });

    // Set the download link now that we have the DB record ID
    await doc.update({ documentLink: `/api/documents/${doc.id}/download` });

    await AuditLogger.log({
      entityType: 'DOCUMENT',
      entityId:   doc.id,
      action:     'CREATE',
      data:       { documentType: doc.documentType, documentCategory: doc.documentCategory },
      actorId:    actorId || 1,
      options:    { actorType: 'USER', source: userAgent },
    });

    logger.info(`Document ${doc.id} uploaded by user ${actorId}`);
    return doc;
  },

  // ─── List / Query ─────────────────────────────────────────────────────────

  async getAllDocuments(filters = {}) {
    const where = { status: { [Op.ne]: DocumentStatus.DELETED } };
    if (filters.clientId)         where.clientId = filters.clientId;
    if (filters.loanId)           where.loanId   = filters.loanId;
    if (filters.collateralId)     where.collateralId = filters.collateralId;
    if (filters.documentType)     where.documentType = filters.documentType;
    if (filters.documentCategory) where.documentCategory = filters.documentCategory;
    if (filters.status)           where.status = filters.status;

    return Document.findAll({ where, order: [['created_at', 'DESC']] });
  },

  async getDocumentsByClient(clientId) {
    return Document.findAll({
      where: { clientId, status: { [Op.ne]: DocumentStatus.DELETED } },
      order: [['created_at', 'DESC']],
    });
  },

  async getDocumentsByLoan(loanId) {
    return Document.findAll({
      where: { loanId, status: { [Op.ne]: DocumentStatus.DELETED } },
      order: [['created_at', 'DESC']],
    });
  },

  async getDocumentById(id) {
    const doc = await Document.findByPk(id);
    if (!doc || doc.status === DocumentStatus.DELETED) {
      throw Object.assign(new Error('Document not found'), { statusCode: 404 });
    }
    return doc;
  },

  // ─── Update metadata ──────────────────────────────────────────────────────

  async updateDocument(id, data, actor, userAgent = 'unknown') {
    const actorId = actor?.id || null;
    const doc = await this.getDocumentById(id);

    const allowed = ['documentType', 'documentCategory', 'description', 'expiresAt', 'status'];
    const updates = {};
    allowed.forEach(k => { if (data[k] !== undefined) updates[k] = data[k]; });
    updates.updatedBy = actorId;

    await doc.update(updates);

    await AuditLogger.log({
      entityType: 'DOCUMENT',
      entityId:   id,
      action:     'UPDATE',
      data:       { changes: updates },
      actorId:    actorId || 1,
      options:    { actorType: 'USER', source: userAgent },
    });

    logger.info(`Document ${id} updated by user ${actorId}`);
    return doc;
  },

  // ─── Download / serve ─────────────────────────────────────────────────────

  /**
   * Return the information needed to stream a document to the client.
   * For local storage this is an absolute filesystem path.
   * For cloud providers this would be a signed URL (future).
   */
  async getDownloadInfo(id) {
    const doc = await this.getDocumentById(id);

    if (doc.storageProvider === 'local') {
      const { getAbsolutePath } = require('../utils/storage/providers/localProvider');
      const filePath = getAbsolutePath(doc.storedName);
      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        throw Object.assign(new Error('File not found on disk'), { statusCode: 404 });
      }
      return { filePath, mimeType: doc.mimeType, originalName: doc.originalName };
    }

    // Future: return { redirectUrl: signedUrl } for s3/minio
    throw Object.assign(new Error(`Download not yet implemented for provider: ${doc.storageProvider}`), { statusCode: 501 });
  },

  // ─── Soft-delete ──────────────────────────────────────────────────────────

  async deleteDocument(id, actor, userAgent = 'unknown') {
    const actorId = actor?.id || null;
    const doc = await this.getDocumentById(id);

    await doc.update({
      status:    DocumentStatus.DELETED,
      deletedBy: actorId,
      updatedBy: actorId,
    });

    // Optionally remove from storage
    try {
      await provider.remove(doc.storedName);
    } catch (e) {
      logger.warn(`Could not delete file from storage for doc ${id}: ${e.message}`);
    }

    await AuditLogger.log({
      entityType: 'DOCUMENT',
      entityId:   id,
      action:     'DELETE',
      data:       { storedName: doc.storedName },
      actorId:    actorId || 1,
      options:    { actorType: 'USER', source: userAgent },
    });

    logger.info(`Document ${id} soft-deleted by user ${actorId}`);
    return { success: true };
  },
};

module.exports = documentService;

const fs = require('fs');
const Document = require('../models/documentModel');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const { resolveProvider } = require('../utils/storage/storageFactory');
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
    const { provider, providerName } = await resolveProvider();

    // Build a sub-path so files are grouped: <category>/<userId|clientId|loanId>
    const folder = meta.userId
      ? `${meta.documentCategory}/user_${meta.userId}`
      : meta.clientId
        ? `${meta.documentCategory}/client_${meta.clientId}`
        : meta.loanId
          ? `${meta.documentCategory}/loan_${meta.loanId}`
          : meta.documentCategory;

    // An owner (user / client / loan [/ collateral]) may only have one active
    // document of a given documentType: if a matching row already exists,
    // replace its stored file and update its metadata in place instead of
    // creating a duplicate document record. This applies uniformly to e.g.
    // a user's profile photo, a client's national_id scan, or a loan's
    // title_deed being re-uploaded/updated.
    const existing = await this._findReplaceableDocument(meta);
    if (existing) {
      return this._replaceDocument(existing, file, meta, folder, provider, providerName, actorId, userAgent);
    }

    const { storedName, documentLink, fileSize, mimeType } = await provider.save(file, folder);

    const doc = await Document.create({
      documentType:     meta.documentType,
      documentCategory: meta.documentCategory,
      userId:           meta.userId       || null,
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

  /**
   * Find an existing, non-deleted document for the same owner + documentType
   * as the one being uploaded, so it can be replaced in place rather than
   * duplicated. "Owner" is whichever of userId/clientId/loanId/collateralId
   * were supplied in meta (only those actually provided are matched on).
   * @private
   */
  async _findReplaceableDocument(meta) {
    const where = {
      documentType: meta.documentType,
      status:       { [Op.ne]: DocumentStatus.DELETED },
    };
    if (meta.userId)       where.userId = meta.userId;
    if (meta.clientId)     where.clientId = meta.clientId;
    if (meta.loanId)       where.loanId = meta.loanId;
    if (meta.collateralId) where.collateralId = meta.collateralId;

    return Document.findOne({ where });
  },

  /**
   * Replace the file behind an existing document row: save the new file to
   * storage, update the row's metadata in place (id/documentLink unchanged),
   * then best-effort delete the previous file from storage.
   * @private
   */
  async _replaceDocument(existing, file, meta, folder, provider, providerName, actorId, userAgent) {
    const previousStoredName = existing.storedName;
    const previousProvider   = existing.storageProvider;

    const { storedName, fileSize, mimeType } = await provider.save(file, folder);

    await existing.update({
      originalName:     file.originalname,
      storedName,
      mimeType,
      fileSize,
      storageProvider:  providerName,
      status:           DocumentStatus.ACTIVE,
      expiresAt:        meta.expiresAt    !== undefined ? meta.expiresAt    : existing.expiresAt,
      description:      meta.description  !== undefined ? meta.description : existing.description,
      updatedBy:        actorId,
    });

    // Best-effort cleanup of the previous file. Only possible when it was
    // stored under the currently active provider.
    if (previousProvider === providerName) {
      try {
        await provider.remove(previousStoredName);
      } catch (e) {
        logger.warn(`Could not delete previous file for document ${existing.id}: ${e.message}`);
      }
    } else {
      logger.warn(`Skipped deleting previous file for document ${existing.id}: stored under provider "${previousProvider}", active provider is "${providerName}"`);
    }

    await AuditLogger.log({
      entityType: 'DOCUMENT',
      entityId:   existing.id,
      action:     'UPDATE',
      data:       { documentType: existing.documentType, documentCategory: existing.documentCategory, replacedFile: true },
      actorId:    actorId || 1,
      options:    { actorType: 'USER', source: userAgent },
    });

    logger.info(`Document ${existing.id} (${existing.documentType}) replaced by user ${actorId}`);
    return existing;
  },

  // ─── List / Query ─────────────────────────────────────────────────────────

  async getAllDocuments(filters = {}) {
    const where = { status: { [Op.ne]: DocumentStatus.DELETED } };
    if (filters.userId)           where.userId = filters.userId;
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

  async getDocumentsByUser(userId) {
    return Document.findAll({
      where: { userId, status: { [Op.ne]: DocumentStatus.DELETED } },
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
   * Return the information needed to serve a document to the client.
   * For local storage this is an absolute filesystem path.
   * For S3-compatible providers (S3/R2/MinIO) this is a live object stream —
   * fetched from the bucket server-side and piped through the API
   */
  async getDownloadInfo(id) {
    const doc = await this.getDocumentById(id);
    const { provider, providerName } = await resolveProvider();

    if (doc.storageProvider !== providerName) {
      throw Object.assign(
        new Error(`Document was stored with provider "${doc.storageProvider}" but the active provider is "${providerName}"`),
        { statusCode: 501 },
      );
    }

    const info = await provider.getDownloadInfo(doc.storedName);

    if (info.type === 'file') {
      if (!fs.existsSync(info.filePath)) {
        throw Object.assign(new Error('File not found on disk'), { statusCode: 404 });
      }
      return { filePath: info.filePath, mimeType: doc.mimeType, originalName: doc.originalName };
    }

    if (info.type === 'stream') {
      return {
        stream: info.body,
        contentLength: info.contentLength,
        mimeType: doc.mimeType || info.contentType,
        originalName: doc.originalName,
      };
    }

    throw Object.assign(new Error(`Unsupported download info type: ${info.type}`), { statusCode: 500 });
  },

  // ─── Soft-delete ──────────────────────────────────────────────────────────

  async deleteDocument(id, actor, userAgent = 'unknown') {
    const actorId = actor?.id || null;
    const doc = await this.getDocumentById(id);
    const { provider } = await resolveProvider();

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

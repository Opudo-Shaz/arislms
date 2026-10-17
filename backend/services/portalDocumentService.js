const { Op } = require('sequelize');
const Client = require('../models/clientModel');
const Document = require('../models/documentModel');
const ClientStatus = require('../enums/clientStatus');
const DocumentCategory = require('../enums/documentCategory');
const DocumentStatus = require('../enums/documentStatus');
const DocumentVerificationStatus = require('../enums/documentVerificationStatus');
const documentService = require('./documentService');
const { KYC_DOCUMENT_TYPES, requiredKycTypes } = require('./clientSelfRegistrationService');
const { validateUpload } = require('../utils/fileSecurity');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

const httpError = (message, status) => Object.assign(new Error(message), { status });

const ownKycDocuments = (clientId) => Document.findAll({
  where: {
    clientId,
    documentCategory: DocumentCategory.CLIENT_KYC,
    status: { [Op.ne]: DocumentStatus.DELETED },
  },
  order: [['created_at', 'DESC']],
});

async function loadClient(clientId) {
  const client = await Client.findByPk(clientId, { attributes: ['id', 'status', 'idDocumentType'] });
  if (!client) throw httpError('Client not found', 404);
  return client;
}

/**
 * Which KYC document types the client may upload right now: only while staff
 * have asked for reverification, and only files flagged for re-upload plus
 * required types (photo + ID) that were never provided.
 */
function uploadableTypes(client, docs) {
  if (client.status !== ClientStatus.PENDING_KYC_REVERIFICATION) return [];
  const byType = new Map(docs.map((d) => [d.documentType, d]));
  const flagged = docs
    .filter((d) => d.verificationStatus === DocumentVerificationStatus.PENDING_REVERIFICATION)
    .map((d) => d.documentType);
  const missing = requiredKycTypes(client.idDocumentType).filter((t) => !byType.has(t));
  return [...new Set([...flagged, ...missing])];
}

const portalDocumentService = {
  /** @returns {Promise<{documents: object[], editable: boolean, uploadableTypes: string[]}>} */
  async listMine(clientId) {
    const [client, docs] = await Promise.all([loadClient(clientId), ownKycDocuments(clientId)]);
    const types = uploadableTypes(client, docs);
    return { documents: docs, editable: types.length > 0, uploadableTypes: types };
  },

  /** Download info for one of the client's own KYC files; anything else is a 404. */
  async getMyDownload(clientId, documentId) {
    const doc = await Document.findOne({
      where: {
        id: documentId,
        clientId,
        documentCategory: DocumentCategory.CLIENT_KYC,
        status: { [Op.ne]: DocumentStatus.DELETED },
      },
      attributes: ['id'],
    });
    if (!doc) throw httpError('Document not found', 404);
    return documentService.getDownloadInfo(doc.id);
  },

  async uploadMine(clientId, documentType, file, userAgent = 'unknown') {
    if (!file) throw httpError('Choose a file to upload', 400);
    if (!KYC_DOCUMENT_TYPES.includes(documentType)) throw httpError('This document type cannot be uploaded here', 400);

    const [client, docs] = await Promise.all([loadClient(clientId), ownKycDocuments(clientId)]);
    if (client.status !== ClientStatus.PENDING_KYC_REVERIFICATION) {
      throw httpError('Your documents can only be changed when we ask you to re-verify your identity.', 403);
    }
    if (!uploadableTypes(client, docs).includes(documentType)) {
      throw httpError('This document has not been requested for re-upload.', 403);
    }

    const check = validateUpload(file);
    if (!check.ok) throw httpError(check.error, 400);
    file.mimetype = check.mimeType;
    file.originalname = check.safeName;

    const doc = await documentService.uploadDocument(
      file,
      { documentType, documentCategory: DocumentCategory.CLIENT_KYC, clientId, description: 'Uploaded by client via portal' },
      null,
      userAgent,
      { actorType: 'CLIENT', clientId }
    );
    logger.info(`[portal] client ${clientId} uploaded KYC document ${doc.id} (${documentType})`);
    return doc;
  },

  /** Ask staff to let the client replace a verified file (e.g. it expired or details changed). */
  async requestChange(clientId, documentId, reason, userAgent = 'unknown') {
    const doc = await Document.findOne({
      where: {
        id: documentId,
        clientId,
        documentCategory: DocumentCategory.CLIENT_KYC,
        status: { [Op.ne]: DocumentStatus.DELETED },
      },
    });
    if (!doc) throw httpError('Document not found', 404);
    if (doc.verificationStatus !== DocumentVerificationStatus.VERIFIED) {
      throw httpError('A change can only be requested for a verified document.', 409);
    }

    await doc.update({
      verificationStatus: DocumentVerificationStatus.CHANGE_REQUESTED,
      verificationNotes: `Client request: ${reason}`,
    });

    await AuditLogger.log({
      entityType: 'DOCUMENT',
      entityId: doc.id,
      action: 'UPDATE',
      data: { verificationStatus: { from: DocumentVerificationStatus.VERIFIED, to: DocumentVerificationStatus.CHANGE_REQUESTED }, reason },
      actorId: clientId,
      options: { actorType: 'CLIENT', source: userAgent },
    });

    logger.info(`[portal] client ${clientId} requested a change to KYC document ${doc.id}`);
    return doc;
  },
};

module.exports = portalDocumentService;

const Client = require('../models/clientModel');
const DocumentCategory = require('../enums/documentCategory');
const DocumentType = require('../enums/documentType');
const KycStatus = require('../enums/kycStatus');
const clientService = require('./clientService');
const documentService = require('./documentService');
const registrationLinkService = require('./clientRegistrationLinkService');
const systemConfigService = require('./systemConfigService');
const { validateUpload } = require('../utils/fileSecurity');
const logger = require('../config/logger');

const REQUIRED_PHOTO = DocumentType.CLIENT_PHOTO;

// Same selectable types as the staff "KYC Documents" card; multipart field name = document type.
const KYC_DOCUMENT_TYPES = [
  DocumentType.CLIENT_PHOTO,
  DocumentType.NATIONAL_ID,
  DocumentType.PASSPORT,
  DocumentType.DRIVING_LICENSE,
  DocumentType.BIRTH_CERTIFICATE,
  DocumentType.OTHER,
];

const ID_TYPE_TO_DOCUMENT_TYPE = {
  national_id: DocumentType.NATIONAL_ID,
  passport: DocumentType.PASSPORT,
  driving_license: DocumentType.DRIVING_LICENSE,
};

const labelOf = (type) => type.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// Missing config row keeps the original behaviour (documents required).
const areKycDocumentsRequired = () =>
  systemConfigService.getConfigValue('client.registration.require_kyc_documents', 'boolean', true);

/** Document types a client must have on file: their photo plus the ID matching their stated ID type. */
const requiredKycTypes = (idDocumentType) => [
  REQUIRED_PHOTO,
  ID_TYPE_TO_DOCUMENT_TYPE[idDocumentType] || DocumentType.OTHER,
];

const validationError = (errors) =>
  Object.assign(new Error('Validation error'), { status: 400, errors });

/**
 * Validate every uploaded file against its bytes. Returns the files with their
 * trusted MIME type and sanitised name applied, or throws a 400 listing each
 * rejected field.
 */
function checkFiles(files = {}, idDocumentType, requireKyc = true) {
  const errors = [];
  const accepted = {};

  if (requireKyc) {
    for (const field of requiredKycTypes(idDocumentType)) {
      if (!files[field]?.[0]) errors.push({ field: `files.${field}`, message: `${labelOf(field)} is required` });
    }
  }

  for (const [field, list] of Object.entries(files)) {
    const file = list?.[0];
    if (!file) continue;
    const result = validateUpload(file);
    if (!result.ok) {
      errors.push({ field: `files.${field}`, message: `${labelOf(field)}: ${result.error}` });
      continue;
    }
    file.mimetype = result.mimeType;
    file.originalname = result.safeName;
    accepted[field] = file;
  }

  if (errors.length) throw validationError(errors);
  return accepted;
}

/**
 * Public self-registration through an invite link. Creates a PENDING client
 * awaiting KYC review, then stores the validated KYC documents. If any
 * document can't be saved the client and already-stored files are removed so
 * the applicant can retry cleanly.
 *
 * @param {string} rawToken
 * @param {object} data   - validated ClientRegistrationRequestDto.submitSchema payload
 * @param {object} files  - multer `fields()` result keyed by field name
 * @returns {Promise<{referenceNumber: string}>}
 */
async function registerViaLink(rawToken, data, files, userAgent = 'unknown') {
  const link = await registrationLinkService.resolveToken(rawToken);
  const accepted = checkFiles(files, data.idDocumentType, await areKycDocumentsRequired());

  let client;
  try {
    client = await clientService.createClient(data, null, userAgent, {
      registrationSource: 'self_link',
      registrationLinkId: link.id,
      kycStatus: KycStatus.IN_PROGRESS,
    });
  } catch (err) {
    // Don't reveal which identifier is already on file to an anonymous caller.
    if (err.statusCode === 409 || err.name === 'SequelizeUniqueConstraintError') {
      throw Object.assign(
        new Error('A client with these details is already registered. Please contact us if you need help.'),
        { status: 409 }
      );
    }
    if (err.status) throw err;
    logger.error(`[selfRegistration] client creation failed: ${err.message}`);
    throw Object.assign(new Error('Registration could not be completed. Please try again.'), { status: 500 });
  }

  const stored = [];
  try {
    for (const [field, file] of Object.entries(accepted)) {
      const doc = await documentService.uploadDocument(
        file,
        {
          documentType: field,
          documentCategory: DocumentCategory.CLIENT_KYC,
          clientId: client.id,
          description: `Submitted via registration link #${link.id}`,
        },
        null,
        userAgent
      );
      stored.push(doc);
    }
  } catch (err) {
    logger.error(`[selfRegistration] document upload failed for client ${client.id}: ${err.message}`);
    await Promise.all(stored.map((d) => documentService.deleteDocument(d.id, null, userAgent).catch(() => null)));
    await Client.destroy({ where: { id: client.id } });
    throw Object.assign(new Error('We could not save your documents. Please try again.'), { status: 500 });
  }

  return { referenceNumber: client.accountNumber };
}

module.exports = { registerViaLink, areKycDocumentsRequired, requiredKycTypes, KYC_DOCUMENT_TYPES };

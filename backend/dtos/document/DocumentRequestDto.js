const Joi = require('joi');
const DocumentVerificationStatus = require('../../enums/documentVerificationStatus');

class DocumentRequestDto {
  // Staff may only settle a review; pending_review / change_requested are set by uploads and the client.
  static verificationSchema = Joi.object({
    verificationStatus: Joi.string()
      .valid(DocumentVerificationStatus.VERIFIED, DocumentVerificationStatus.PENDING_REVERIFICATION)
      .required(),
    notes: Joi.string().trim().max(1000).allow(null, '')
      .when('verificationStatus', {
        is: DocumentVerificationStatus.PENDING_REVERIFICATION,
        then: Joi.required().invalid(null, '').messages({ 'any.invalid': 'Tell the client what needs to change', 'any.required': 'Tell the client what needs to change' }),
      }),
    requestClientReverification: Joi.boolean().default(false),
  });
}

module.exports = DocumentRequestDto;

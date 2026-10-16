const registrationLinkService = require('../services/clientRegistrationLinkService');
const registrationOtpService = require('../services/clientRegistrationOtpService');
const selfRegistrationService = require('../services/clientSelfRegistrationService');
const ClientRegistrationRequestDto = require('../dtos/clientRegistration/ClientRegistrationRequestDto');
const { validateSync } = require('../utils/validationMiddleware');
const logger = require('../config/logger');

const fail = (res, err, context) => {
  const status = err.status || 500;
  if (status >= 500) logger.error(`${context}: ${err.message}`);
  return res.status(status).json({
    success: false,
    message: err.message,
    ...(err.errors ? { errors: err.errors } : {}),
  });
};

const invalid = (res, errors) =>
  res.status(400).json({ success: false, message: 'Validation error', errors });

// GET /api/public/client-registration/:token
const resolveLink = async (req, res) => {
  try {
    const link = await registrationLinkService.resolveToken(req.params.token);
    return res.json({
      success: true,
      data: {
        label: link.label,
        expiresAt: link.expiresAt,
        otpRequired: await registrationOtpService.isEnabled(),
      },
    });
  } catch (err) {
    return fail(res, err, 'Error resolving registration link');
  }
};

// POST /api/public/client-registration/:token/otp/request
const requestOtp = async (req, res) => {
  const validation = validateSync(req.body, ClientRegistrationRequestDto.otpRequestSchema);
  if (!validation.valid) return invalid(res, validation.errors);
  try {
    await registrationLinkService.resolveToken(req.params.token);
    const result = await registrationOtpService.requestCode(validation.value, req.headers['user-agent']);
    return res.json({ success: true, data: result });
  } catch (err) {
    return fail(res, err, 'Error requesting registration OTP');
  }
};

// POST /api/public/client-registration/:token/otp/verify
const verifyOtp = async (req, res) => {
  const validation = validateSync(req.body, ClientRegistrationRequestDto.otpVerifySchema);
  if (!validation.valid) return invalid(res, validation.errors);
  try {
    await registrationLinkService.resolveToken(req.params.token);
    const result = await registrationOtpService.verifyCode(validation.value, req.headers['user-agent']);
    return res.json({ success: true, data: result });
  } catch (err) {
    return fail(res, err, 'Error verifying registration OTP');
  }
};

// POST /api/public/client-registration/:token/submit  (multipart: `payload` JSON + files)
const submit = async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(req.body?.payload || '');
  } catch {
    return invalid(res, [{ field: 'payload', message: 'The registration form data is missing or malformed' }]);
  }

  const validation = validateSync(payload, ClientRegistrationRequestDto.submitSchema);
  if (!validation.valid) return invalid(res, validation.errors);

  try {
    const result = await selfRegistrationService.registerViaLink(
      req.params.token, validation.value, req.files, req.headers['user-agent']
    );
    return res.status(201).json({ success: true, message: 'Registration submitted', data: result });
  } catch (err) {
    return fail(res, err, 'Error submitting client registration');
  }
};

module.exports = { resolveLink, requestOtp, verifyOtp, submit };

const registrationOtpService = require('../services/clientRegistrationOtpService');
const ClientRegistrationRequestDto = require('../dtos/clientRegistration/ClientRegistrationRequestDto');
const { validateSync } = require('../utils/validationMiddleware');
const logger = require('../config/logger');

// Staff-side phone verification for the "create client" form.

const fail = (res, err, context) => {
  const status = err.status || 500;
  if (status >= 500) logger.error(`${context}: ${err.message}`);
  return res.status(status).json({ success: false, message: err.message });
};

// GET /api/clients/registration-config
const getConfig = async (_req, res) => {
  try {
    return res.json({ success: true, data: { otpRequired: await registrationOtpService.isEnabled() } });
  } catch (err) {
    return fail(res, err, 'Error reading client registration config');
  }
};

// POST /api/clients/phone-otp/request
const requestOtp = async (req, res) => {
  const validation = validateSync(req.body, ClientRegistrationRequestDto.otpRequestSchema);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
  }
  try {
    const data = await registrationOtpService.requestCode(validation.value, req.headers['user-agent']);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'Error requesting client phone OTP');
  }
};

// POST /api/clients/phone-otp/verify
const verifyOtp = async (req, res) => {
  const validation = validateSync(req.body, ClientRegistrationRequestDto.otpVerifySchema);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
  }
  try {
    const data = await registrationOtpService.verifyCode(validation.value, req.headers['user-agent']);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'Error verifying client phone OTP');
  }
};

module.exports = { getConfig, requestOtp, verifyOtp };

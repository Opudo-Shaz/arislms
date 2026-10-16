const registrationLinkService = require('../services/clientRegistrationLinkService');
const ClientRegistrationRequestDto = require('../dtos/clientRegistration/ClientRegistrationRequestDto');
const { validateSync } = require('../utils/validationMiddleware');
const { getUserId } = require('../utils/helpers');
const logger = require('../config/logger');

const fail = (res, err, context) => {
  const status = err.status || 500;
  if (status >= 500) logger.error(`${context}: ${err.message}`);
  return res.status(status).json({ success: false, message: err.message });
};

// POST /api/client-registration-links
const createLink = async (req, res) => {
  const validation = validateSync(req.body, ClientRegistrationRequestDto.createLinkSchema);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
  }
  try {
    const { link, url, warnings, sent } = await registrationLinkService.createLink(
      validation.value, getUserId(req), req.headers['user-agent']
    );
    return res.status(201).json({ success: true, data: await registrationLinkService.summarize(link), url, warnings, sent });
  } catch (err) {
    return fail(res, err, 'Error creating registration link');
  }
};

// GET /api/client-registration-links
const listLinks = async (req, res) => {
  try {
    const data = await registrationLinkService.listLinks({ status: req.query.status });
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'Error listing registration links');
  }
};

// GET /api/client-registration-links/:id
const getLink = async (req, res) => {
  try {
    return res.json({ success: true, data: await registrationLinkService.getLink(req.params.id) });
  } catch (err) {
    return fail(res, err, 'Error fetching registration link');
  }
};

// GET /api/client-registration-links/:id/url
const getLinkUrl = async (req, res) => {
  try {
    return res.json({ success: true, url: await registrationLinkService.getLinkUrl(req.params.id) });
  } catch (err) {
    return fail(res, err, 'Error reading registration link URL');
  }
};

// POST /api/client-registration-links/:id/revoke
const revokeLink = async (req, res) => {
  try {
    await registrationLinkService.revokeLink(req.params.id, getUserId(req), req.headers['user-agent']);
    return res.json({ success: true, data: await registrationLinkService.getLink(req.params.id) });
  } catch (err) {
    return fail(res, err, 'Error revoking registration link');
  }
};

module.exports = { createLink, listLinks, getLink, getLinkUrl, revokeLink };

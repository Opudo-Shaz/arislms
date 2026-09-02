const invitationService = require('../services/invitationService');
const InvitationRequestDto = require('../dtos/invitation/InvitationRequestDto');
const InvitationResponseDto = require('../dtos/invitation/InvitationResponseDto');
const UserResponseDto = require('../dtos/user/UserResponseDto');
const { validateSync } = require('../utils/validationMiddleware');
const { getUserId } = require('../utils/helpers');
const logger = require('../config/logger');

// POST /api/invitations — admin/manager only
const createInvitation = async (req, res) => {
  const validation = validateSync(req.body, InvitationRequestDto.createSchema);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
  }

  const actorId = getUserId(req);
  const userAgent = req.headers['user-agent'];
  const actorPermissions = req.user?.permissions || [];

  try {
    const { invitation, inviteUrl, warnings } = await invitationService.createInvitation(
      validation.value, actorId, userAgent, actorPermissions
    );
    return res.status(201).json({
      success: true,
      data: new InvitationResponseDto(invitation),
      inviteUrl,
      warnings,
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error(`Error creating invitation: ${err.message}`);
    return res.status(status).json({ success: false, message: err.message });
  }
};

// GET /api/invitations — admin/manager only
const listInvitations = async (req, res) => {
  try {
    const { status } = req.query;
    const invitations = await invitationService.listInvitations({ status });
    return res.json({ success: true, data: invitations.map((i) => new InvitationResponseDto(i)) });
  } catch (err) {
    logger.error(`Error listing invitations: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/invitations/:id/resend — admin/manager only
const resendInvitation = async (req, res) => {
  const actorId = getUserId(req);
  const userAgent = req.headers['user-agent'];

  try {
    const { invitation, inviteUrl, warnings } = await invitationService.resendInvitation(
      req.params.id, actorId, userAgent
    );
    return res.json({ success: true, data: new InvitationResponseDto(invitation), inviteUrl, warnings });
  } catch (err) {
    const status = err.status || 500;
    logger.error(`Error resending invitation ${req.params.id}: ${err.message}`);
    return res.status(status).json({ success: false, message: err.message });
  }
};

// POST /api/invitations/:id/revoke — admin/manager only
const revokeInvitation = async (req, res) => {
  const actorId = getUserId(req);
  const userAgent = req.headers['user-agent'];

  try {
    const invitation = await invitationService.revokeInvitation(req.params.id, actorId, userAgent);
    return res.json({ success: true, data: new InvitationResponseDto(invitation) });
  } catch (err) {
    const status = err.status || 500;
    logger.error(`Error revoking invitation ${req.params.id}: ${err.message}`);
    return res.status(status).json({ success: false, message: err.message });
  }
};

// GET /api/invitations/verify?token=... — PUBLIC (prefill for the registration page)
const verifyInvitation = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  try {
    const invitation = await invitationService.getInvitationByToken(token);
    return res.json({ success: true, data: new InvitationResponseDto(invitation) });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

// POST /api/invitations/accept — PUBLIC (completes registration)
const acceptInvitation = async (req, res) => {
  const validation = validateSync(req.body, InvitationRequestDto.acceptSchema);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: validation.errors });
  }

  const { token, ...data } = validation.value;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const newUser = await invitationService.completeInvitation(token, data, userAgent);
    return res.status(201).json({
      success: true,
      message: 'Registration complete. You can now log in.',
      data: new UserResponseDto(newUser),
    });
  } catch (err) {
    const status = err.status || 500;
    logger.warn(`[acceptInvitation] Failed: ${err.message}`);
    return res.status(status).json({ success: false, message: err.message });
  }
};

module.exports = {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  verifyInvitation,
  acceptInvitation,
};

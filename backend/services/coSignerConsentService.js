const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const CoSignerConsent = require('../models/coSignerConsentModel');
const Loan = require('../models/loanModel');
const Client = require('../models/clientModel');
const LoanProduct = require('../models/loanProductModel');
const CoSignerConsentStatus = require('../enums/coSignerConsentStatus');
const ClientStatus = require('../enums/clientStatus');
const LoanStatus = require('../enums/loanStatus');
const NotificationEventType = require('../enums/notificationEventType');
const NotificationChannel = require('../enums/notificationChannel');
const { PERMISSIONS } = require('../constants/permissions');
const { getActiveUsersWithPermission } = require('../utils/permissionUtils');
const { buildRecipients, safeNotify } = require('./notification/notificationTriggers');
const otpService = require('./otpService');
const systemConfigService = require('./systemConfigService');
const { findClientByPhone } = require('./portalAuthService');
const { maskName, maskPhone, maskEmail } = require('../utils/helpers');
const AuditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

/**
 * Co-signer consent: every loan with a co-signer (portal or staff-created)
 * needs the co-signer's explicit consent before it can be approved.
 *
 *   1. requestConsent()  — issues a tokenised link by SMS/email to the co-signer
 *   2. getPublicView()   — the link page shows the loan they're asked to guarantee
 *   3. sendResponseOtp() — a one-time code to the co-signer's own phone/email
 *   4. respond()         — verify the code, record accept/decline, notify the
 *                          borrower (SMS/email) and approvers (in-app)
 *
 * A declined or expired request leaves the loan pending; the borrower can
 * nominate someone else from the portal (renominate), and staff can resend.
 */

const OTP_PURPOSE = 'cosigner_consent';
// Codes are bound to one consent request, so a code sent for an earlier
// (superseded) request can't answer a newer one. Fits otps.purpose (32 chars).
const otpPurposeFor = (consent) => `${OTP_PURPOSE}:${consent.id}`;
const DEFAULT_TTL_HOURS = 72;
const RESEND_COOLDOWN_SECONDS = 60;

// Loans whose co-signer can still be (re)nominated / asked for consent.
const AWAITING_DECISION = [LoanStatus.PENDING, LoanStatus.IN_REVIEW, LoanStatus.UNDER_REVIEW];

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const fullName = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(' ');

const consentUrl = (rawToken) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${frontendUrl}/co-signer/consent/${rawToken}`;
};

/** A co-signer must be an active, KYC-verified client other than the borrower. */
function assertEligibleCoSigner(coSigner, borrowerId) {
  if (!coSigner) throw httpError('Co-signer not found.', 422);
  if (Number(coSigner.id) === Number(borrowerId)) {
    throw httpError('Co-signer cannot be the same person as the borrower.', 422);
  }
  if (coSigner.status !== ClientStatus.ACTIVE || !coSigner.isActive) {
    throw httpError('The co-signer’s account is not active.', 422);
  }
  if (coSigner.kycStatus !== 'verified') {
    throw httpError('The co-signer’s identity verification (KYC) is not complete.', 422);
  }
}

/** Mark a consent (and its loan, if it's still the current request) expired when past its deadline. */
async function expireIfDue(consent) {
  if (consent.status !== CoSignerConsentStatus.PENDING || consent.expiresAt > new Date()) return consent;
  await consent.update({ status: CoSignerConsentStatus.EXPIRED });
  await Loan.update(
    { coSignerConsentStatus: CoSignerConsentStatus.EXPIRED },
    { where: { id: consent.loanId, coSignerId: consent.coSignerId, coSignerConsentStatus: CoSignerConsentStatus.PENDING } }
  );
  return consent;
}

async function findByRawToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') throw httpError('This link is invalid.', 404);
  const consent = await CoSignerConsent.findOne({ where: { tokenHash: hashToken(rawToken) } });
  if (!consent) throw httpError('This link is invalid or has been replaced by a newer one.', 404);
  return expireIfDue(consent);
}

const coSignerConsentService = {
  OTP_PURPOSE,

  /**
   * Portal: find an eligible co-signer by exact phone number. Returns only a
   * masked name/phone plus a short-lived signed pick token — never the client
   * id — so the borrower can confirm the person without browsing clients.
   */
  async lookupByPhone(borrowerId, phone) {
    const candidate = await findClientByPhone(phone);
    if (!candidate || Number(candidate.id) === Number(borrowerId)) {
      throw httpError('We couldn’t find an eligible client with that phone number. Check the number, or ask them to register at a branch.', 404);
    }
    try {
      assertEligibleCoSigner(candidate, borrowerId);
    } catch {
      // Don't reveal *why* someone else's account is ineligible.
      throw httpError('That client can’t co-sign at the moment. Please choose someone else.', 422);
    }
    const coSignerToken = jwt.sign(
      { typ: 'cosigner_pick', coSignerId: candidate.id, borrowerId },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '30m' }
    );
    return {
      coSignerToken,
      displayName: maskName(candidate.firstName, candidate.lastName),
      maskedPhone: maskPhone(candidate.phone),
    };
  },

  /** Resolve a pick token from lookupByPhone back to a co-signer id for this borrower. */
  resolvePickToken(borrowerId, coSignerToken) {
    let payload;
    try {
      payload = jwt.verify(coSignerToken, process.env.JWT_SECRET || 'secretkey');
    } catch {
      throw httpError('Your co-signer selection has expired. Please look them up again.', 422);
    }
    if (payload?.typ !== 'cosigner_pick' || Number(payload.borrowerId) !== Number(borrowerId)) {
      throw httpError('Invalid co-signer selection. Please look them up again.', 422);
    }
    return payload.coSignerId;
  },

  /** Throws if the co-signer can't guarantee this borrower's loan. Used at loan creation/update. */
  async validateCoSigner(coSignerId, borrowerId) {
    const coSigner = await Client.findByPk(coSignerId);
    assertEligibleCoSigner(coSigner, borrowerId);
    return coSigner;
  },

  /**
   * Issue a fresh consent request for the loan's current co-signer: any
   * previous pending request is superseded, a new link is sent by SMS/email,
   * and the loan's consent status becomes 'pending'.
   *
   * @param {object} loan - Loan instance (with coSignerId set)
   * @param {{ requestedBy: string, userAgent?: string }} opts
   * @returns {Promise<{ consent: object, sentTo: string[] }>}
   */
  async requestConsent(loan, { requestedBy, userAgent = 'unknown' } = {}) {
    if (!loan?.coSignerId) throw httpError('This loan has no co-signer.', 422);

    const [coSigner, borrower, product] = await Promise.all([
      Client.findByPk(loan.coSignerId),
      Client.findByPk(loan.clientId),
      LoanProduct.findByPk(loan.loanProductId, { attributes: ['id', 'name'] }),
    ]);
    if (!coSigner) throw httpError('Co-signer not found.', 422);

    await CoSignerConsent.update(
      { status: CoSignerConsentStatus.SUPERSEDED },
      { where: { loanId: loan.id, status: CoSignerConsentStatus.PENDING } }
    );

    const ttlHours = await systemConfigService.getConfigValue(
      'loans.co_signer_consent_ttl_hours', 'number', DEFAULT_TTL_HOURS
    ) || DEFAULT_TTL_HOURS;
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const consent = await CoSignerConsent.create({
      loanId: loan.id,
      coSignerId: coSigner.id,
      borrowerId: loan.clientId,
      tokenHash: hashToken(rawToken),
      status: CoSignerConsentStatus.PENDING,
      expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
      requestedBy,
    });
    await Loan.update({ coSignerConsentStatus: CoSignerConsentStatus.PENDING }, { where: { id: loan.id } });

    const link = consentUrl(rawToken);
    if (process.env.OTP_DEBUG_LOG === 'true' && process.env.NODE_ENV !== 'production') {
      logger.debug(`[coSignerConsent] DEBUG consent link for loan ${loan.id} co-signer ${coSigner.id}: ${link}`);
    }

    await safeNotify(NotificationEventType.CO_SIGNER_CONSENT_REQUEST, {
      recipients: buildRecipients({ client: coSigner }),
      channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
      context: {
        coSignerName: coSigner.firstName,
        borrowerName: fullName(borrower),
        referenceCode: loan.referenceCode,
        currency: loan.currency,
        principalAmount: Number(loan.principalAmount).toLocaleString(),
        termMonths: loan.termMonths,
        productName: product?.name || 'loan',
        consentUrl: link,
        expiresHours: ttlHours,
        appName: process.env.APP_NAME || 'ARISLMS',
      },
      relatedLoanId: loan.id,
      dedupeKey: `co-signer-consent:${consent.id}`,
    });

    await AuditLogger.log({
      entityType: 'LOAN',
      entityId: loan.id,
      action: 'UPDATE',
      data: { event: 'co_signer_consent_requested', consentId: consent.id, coSignerId: coSigner.id, requestedBy },
      actorId: requestedBy?.startsWith('user:') ? Number(requestedBy.slice(5)) : loan.clientId,
      options: { actorType: requestedBy?.startsWith('user:') ? 'USER' : 'CLIENT', source: userAgent },
    });

    logger.info(`[coSignerConsent] consent ${consent.id} requested for loan ${loan.id} (co-signer ${coSigner.id})`);
    return {
      consent,
      sentTo: [coSigner.phone && maskPhone(coSigner.phone), coSigner.email && maskEmail(coSigner.email)].filter(Boolean),
    };
  },

  /** Latest consent for a loan (for staff/portal display). */
  async getLatestForLoan(loanId) {
    const consent = await CoSignerConsent.findOne({ where: { loanId }, order: [['created_at', 'DESC']] });
    return consent ? expireIfDue(consent) : null;
  },

  /**
   * Portal: the borrower nominates a (new) co-signer for their own open
   * loan — allowed while awaiting a decision, e.g. after a decline/expiry.
   */
  async renominate(borrowerId, loanId, coSignerToken, userAgent = 'unknown') {
    const loan = await Loan.findOne({ where: { id: loanId, clientId: borrowerId } });
    if (!loan) throw httpError('Loan not found', 404);
    if (!AWAITING_DECISION.includes(loan.status)) {
      throw httpError('The co-signer can only be changed while the loan is awaiting a decision.', 409);
    }
    if (loan.coSignerConsentStatus === CoSignerConsentStatus.ACCEPTED) {
      throw httpError('Your co-signer has already consented.', 409);
    }
    const coSignerId = this.resolvePickToken(borrowerId, coSignerToken);
    await this.validateCoSigner(coSignerId, borrowerId);
    await loan.update({ coSignerId });
    return this.requestConsent(loan, { requestedBy: 'portal', userAgent });
  },

  // ── Public consent page (by link token) ───────────────────────────────

  async getPublicView(rawToken) {
    const consent = await findByRawToken(rawToken);
    const [loan, borrower, coSigner] = await Promise.all([
      Loan.findByPk(consent.loanId, { include: [{ association: 'loanProduct', attributes: ['id', 'name'] }] }),
      Client.findByPk(consent.borrowerId, { attributes: ['id', 'firstName', 'lastName'] }),
      Client.findByPk(consent.coSignerId, { attributes: ['id', 'firstName', 'lastName', 'phone', 'email'] }),
    ]);
    return {
      status: consent.status,
      expiresAt: consent.expiresAt,
      respondedAt: consent.respondedAt,
      coSignerFirstName: coSigner?.firstName,
      otpDestinations: {
        sms: coSigner?.phone ? maskPhone(coSigner.phone) : null,
        email: coSigner?.email ? maskEmail(coSigner.email) : null,
      },
      borrowerName: fullName(borrower),
      loan: loan
        ? {
            referenceCode: loan.referenceCode,
            productName: loan.loanProduct?.name || null,
            principalAmount: loan.principalAmount,
            currency: loan.currency,
            termMonths: loan.termMonths,
            installmentAmount: loan.installmentAmount,
            interestRate: loan.interestRate,
            interestRatePeriod: loan.interestRatePeriod,
            status: loan.status,
          }
        : null,
    };
  },

  /** Send the co-signer a one-time code to their own phone (SMS) or email. */
  async sendResponseOtp(rawToken, channel = NotificationChannel.SMS, userAgent = 'unknown') {
    const consent = await findByRawToken(rawToken);
    if (consent.status !== CoSignerConsentStatus.PENDING) {
      throw httpError(`This request is no longer open (${consent.status}).`, 409);
    }
    const coSigner = await Client.findByPk(consent.coSignerId);
    const deliveryChannel = channel === NotificationChannel.EMAIL && coSigner?.email
      ? NotificationChannel.EMAIL
      : NotificationChannel.SMS;

    const purpose = otpPurposeFor(consent);
    const since = await otpService.secondsSinceLastIssued({ clientId: coSigner.id, purpose });
    if (since !== null && since < RESEND_COOLDOWN_SECONDS) {
      throw httpError(`Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - since)}s before requesting another code.`, 429);
    }
    await otpService.generateAndSend({
      client: coSigner,
      purpose,
      channels: [deliveryChannel],
      auditContext: { loanId: consent.loanId, consentId: consent.id },
      userAgent,
    });
    return {
      channel: deliveryChannel,
      sentTo: deliveryChannel === NotificationChannel.EMAIL ? maskEmail(coSigner.email) : maskPhone(coSigner.phone),
    };
  },

  /**
   * Record the co-signer's decision after verifying their one-time code.
   * @param {string} rawToken
   * @param {{ decision: 'accept'|'decline', code: string, reason?: string }} body
   */
  async respond(rawToken, { decision, code, reason }, userAgent = 'unknown') {
    const consent = await findByRawToken(rawToken);
    if (consent.status !== CoSignerConsentStatus.PENDING) {
      throw httpError(`This request is no longer open (${consent.status}).`, 409);
    }
    await otpService.verify({
      clientId: consent.coSignerId,
      purpose: otpPurposeFor(consent),
      code,
      auditContext: { loanId: consent.loanId, consentId: consent.id },
      userAgent,
    });

    const accepted = decision === 'accept';
    const status = accepted ? CoSignerConsentStatus.ACCEPTED : CoSignerConsentStatus.DECLINED;

    // Conditional update so a superseded/expired request can't be answered in a race.
    const [updated] = await CoSignerConsent.update(
      { status, respondedAt: new Date(), declineReason: accepted ? null : (reason || null) },
      { where: { id: consent.id, status: CoSignerConsentStatus.PENDING, expiresAt: { [Op.gt]: new Date() } } }
    );
    if (!updated) throw httpError('This request is no longer open.', 409);

    // Only the current request drives the loan's consent status.
    await Loan.update(
      { coSignerConsentStatus: status },
      { where: { id: consent.loanId, coSignerId: consent.coSignerId } }
    );

    const [loan, borrower, coSigner] = await Promise.all([
      Loan.findByPk(consent.loanId),
      Client.findByPk(consent.borrowerId),
      Client.findByPk(consent.coSignerId),
    ]);

    await AuditLogger.log({
      entityType: 'LOAN',
      entityId: consent.loanId,
      // UPDATE, not APPROVE/REJECT: those actions on a LOAN mean the staff
      // approval decision (see AuditService.getActorsByActions → "approved by").
      action: 'UPDATE',
      data: { event: `co_signer_consent_${status}`, consentId: consent.id, coSignerId: consent.coSignerId, reason: reason || null },
      actorId: consent.coSignerId,
      options: { actorType: 'CLIENT', source: userAgent },
    });

    const context = {
      borrowerName: borrower?.firstName,
      coSignerName: fullName(coSigner),
      referenceCode: loan?.referenceCode,
      decisionText: accepted ? 'agreed to co-sign' : 'declined to co-sign',
      nextStep: accepted
        ? 'Your application can now continue to approval.'
        : 'Please sign in to the client portal to nominate a different co-signer.',
      reasonNote: !accepted && reason ? ` Reason given: ${reason}.` : '',
    };

    await safeNotify(NotificationEventType.CO_SIGNER_CONSENT_RESPONDED, {
      recipients: buildRecipients({ client: borrower }),
      channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
      context,
      relatedLoanId: consent.loanId,
      dedupeKey: `co-signer-consent-response:${consent.id}:borrower`,
    });
    const approvers = await getActiveUsersWithPermission(PERMISSIONS.LOANS.APPROVE);
    if (approvers.length) {
      await safeNotify(NotificationEventType.CO_SIGNER_CONSENT_RESPONDED, {
        recipients: approvers,
        channels: [NotificationChannel.IN_APP],
        context,
        relatedLoanId: consent.loanId,
        dedupeKey: `co-signer-consent-response:${consent.id}:staff`,
      });
    }

    logger.info(`[coSignerConsent] consent ${consent.id} ${status} by co-signer ${consent.coSignerId}`);
    return { status };
  },
};

coSignerConsentService.AWAITING_DECISION = AWAITING_DECISION;

module.exports = coSignerConsentService;

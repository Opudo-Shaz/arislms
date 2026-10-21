const Client = require('../models/clientModel');
const LoanProduct = require('../models/loanProductModel');
const loanService = require('./loanService');
const coSignerConsentService = require('./coSignerConsentService');
const NotificationEventType = require('../enums/notificationEventType');
const NotificationChannel = require('../enums/notificationChannel');
const { PERMISSIONS } = require('../constants/permissions');
const { getActiveUsersWithPermission } = require('../utils/permissionUtils');
const { buildRecipients, safeNotify } = require('./notification/notificationTriggers');
const logger = require('../config/logger');

/**
 * Client self-service loan requests. Runs the same credit-scored pipeline as
 * staff-created loans (loanService.createScoredLoan), then alerts everyone who
 * can approve loans that a request is waiting in the queue.
 */

// Policy decision that means the score passed (riskPolicyService.getDecisionFromScore).
const PASSING_DECISION = 'APPROVED';

const unprocessable = (message) => Object.assign(new Error(message), { statusCode: 422 });

/**
 * Translate pipeline errors into messages written for the client. Anything
 * unrecognised is re-thrown unchanged (and surfaces as a generic 500).
 */
function toClientError(error) {
  const msg = error?.message || '';
  // Co-signer problems are already phrased for the borrower — and must not be
  // mistaken for the borrower's own KYC/account status below.
  if (/co-signer/i.test(msg)) return unprocessable(msg);
  if (/KYC is not verified/i.test(msg)) {
    return unprocessable('Your identity verification (KYC) is not complete yet. Please contact support to finish it before applying.');
  }
  if (/existing loan\(s\)/i.test(msg)) {
    return unprocessable('You already have a loan that is open or awaiting a decision. You can apply again once it is closed.');
  }
  if (/exceeds client credit limit \(([\d.]+)\)/i.test(msg)) {
    const limit = msg.match(/credit limit \(([\d.]+)\)/i)[1];
    return Object.assign(
      unprocessable(`The amount you requested is above your current credit limit of ${Number(limit).toLocaleString()}. Please request a lower amount.`),
      { creditLimit: Number(limit) }
    );
  }
  if (/not active|inactive/i.test(msg)) {
    return unprocessable('Your account is not active for new loans. Please contact support.');
  }
  if (error?.statusCode === 422 || error?.statusCode === 400 || /must be|between|minimum|maximum/i.test(msg)) {
    return unprocessable(msg);
  }
  return error;
}

const portalLoanService = {
  /**
   * @param {number} clientId - authenticated client (req.client.id)
   * @param {{loanProductId: number, principalAmount: number, termMonths: number, notes?: string}} dto
   * @returns {Promise<{loan, scorePassed: boolean, riskScore: number, riskGrade: string,
   *   creditLimit: number, message: string}>}
   */
  async submitLoanRequest(clientId, dto, userAgent = 'unknown') {
    const product = await LoanProduct.findByPk(dto.loanProductId);
    if (!product || !product.isActive) throw unprocessable('The selected loan product is not available.');

    // Collateral has to be captured and verified by staff, so those products
    // can't be applied for self-service yet. Co-signers can be nominated here.
    if (product.requiresCollateral) {
      throw unprocessable(`${product.name} requires collateral. Please visit a branch or contact support to apply.`);
    }
    if (product.requiresCoSigner && !dto.coSignerToken) {
      throw unprocessable(`${product.name} requires a co-signer. Look up your co-signer by their phone number first.`);
    }
    const coSignerId = dto.coSignerToken
      ? coSignerConsentService.resolvePickToken(clientId, dto.coSignerToken)
      : undefined;

    const termMonths = Number(dto.termMonths);
    const minTerm = Number(product.minRepaymentPeriodMonths);
    const maxTerm = Number(product.maxRepaymentPeriodMonths);
    if (!termMonths || termMonths < minTerm || termMonths > maxTerm) {
      throw unprocessable(`The repayment period for ${product.name} must be between ${minTerm} and ${maxTerm} months.`);
    }

    let result;
    try {
      result = await loanService.createScoredLoan(
        {
          clientId,
          loanProductId: product.id,
          principalAmount: dto.principalAmount,
          termMonths,
          startDate: new Date().toISOString().slice(0, 10),
          ...(coSignerId ? { coSignerId } : {}),
          notes: dto.notes ? `[Portal request] ${dto.notes}` : '[Portal request]',
        },
        null,
        userAgent,
        { portalClient: { id: clientId } }
      );
    } catch (error) {
      logger.warn(`[portal] loan request by client ${clientId} refused: ${error.message}`);
      throw toClientError(error);
    }

    const { loan, riskScore, riskGrade, creditLimit, riskDecision } = result;
    const scorePassed = riskDecision === PASSING_DECISION;

    await this.notifyApprovers({ loan, clientId, product, riskScore, riskGrade, scorePassed });

    const coSignerNote = loan.coSignerId
      ? ' We have sent your co-signer a link to consent — your loan can only be approved after they accept.'
      : '';
    const message = (scorePassed
      ? 'Your loan request has been submitted and is awaiting approval. We will notify you once a decision is made.'
      : 'Your credit score did not meet the threshold for automatic pre-approval. Your request has still been queued for manual review — '
        + 'if you believe your score does not reflect your situation, please contact support.') + coSignerNote;

    return { loan, scorePassed, riskScore, riskGrade, creditLimit, message };
  },

  /** Alert every active user who can approve loans, plus a receipt to the client. */
  async notifyApprovers({ loan, clientId, product, riskScore, riskGrade, scorePassed }) {
    const client = await Client.findByPk(clientId);
    const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(' ');
    const baseContext = {
      clientName,
      referenceCode: loan.referenceCode,
      currency: loan.currency,
      principalAmount: Number(loan.principalAmount).toLocaleString(),
      productName: product.name,
      riskScore,
      riskGrade,
    };

    const approvers = await getActiveUsersWithPermission(PERMISSIONS.LOANS.APPROVE);
    if (approvers.length) {
      await safeNotify(NotificationEventType.LOAN_APPLICATION_SUBMITTED, {
        recipients: approvers,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        context: {
          ...baseContext,
          needsManualReview: !scorePassed,
          reviewNote: scorePassed
            ? 'Passed automatic scoring.'
            : 'NEEDS MANUAL REVIEW — score below the auto-approval threshold.',
        },
        relatedLoanId: loan.id,
        dedupeKey: `loan-submitted:${loan.id}`,
      });
    } else {
      logger.warn(`[portal] no active users hold ${PERMISSIONS.LOANS.APPROVE}; loan ${loan.id} queued without alerts`);
    }

    await safeNotify(NotificationEventType.LOAN_APPLICATION_RECEIVED, {
      recipients: buildRecipients({ client }),
      context: {
        ...baseContext,
        statusNote: scorePassed
          ? 'It is now awaiting approval.'
          : 'It has been queued for manual review. Contact support if you have questions about your credit score.',
      },
      relatedLoanId: loan.id,
      dedupeKey: `loan-received:${loan.id}`,
    });
  },
};

module.exports = portalLoanService;

const LoanResponseDto = require('../loan/LoanResponseDto');
const { maskName } = require('../../utils/helpers');
const CreditScoreResponseDto = require('../creditScore/CreditScoreResponseDto');

/**
 * Client-facing response shapes. These wrap the staff DTOs but drop internal
 * fields a borrower shouldn't see (staff names, ledger transactions, scoring
 * breakdown internals, KYC reviewer ids).
 */

function PortalProfileDto(client) {
  const score = client.creditScores && client.creditScores[0];
  return {
    id: client.id,
    accountNumber: client.accountNumber,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    secondaryPhone: client.secondaryPhone,
    dateOfBirth: client.dateOfBirth,
    gender: client.gender,
    occupation: client.occupation,
    employer: client.employer,
    address: client.address,
    idDocumentType: client.idDocumentType,
    preferredContactMethod: client.preferredContactMethod,
    status: client.status,
    kycStatus: client.kycStatus,
    kycVerifiedAt: client.kycVerifiedAt,
    loanTenure: client.loanTenure,
    lastLoginAt: client.lastLoginAt,
    creditScore: score ? PortalCreditScoreDto(score) : null,
  };
}

function PortalCreditScoreDto(score) {
  if (!score) return null;
  const dto = new CreditScoreResponseDto(score);
  return {
    riskScore: dto.riskScore,
    riskGrade: dto.riskGrade,
    creditLimit: dto.creditLimit,
    createdAt: dto.createdAt,
  };
}

function PortalLoanDto(loan) {
  const dto = LoanResponseDto(loan);
  delete dto.transactions;
  delete dto.approvedBy;
  delete dto.disbursedBy;
  dto.productName = loan.loanProduct ? loan.loanProduct.name : null;
  dto.nextPaymentDate = loan.nextPaymentDate ?? null;
  dto.source = loan.source;
  dto.creditScore = loan.creditScore ? PortalCreditScoreDto(loan.creditScore) : null;
  // The borrower sees only a masked co-signer name, never their contact details.
  dto.coSigner = loan.coSigner ? { displayName: maskName(loan.coSigner.firstName, loan.coSigner.lastName) } : null;
  delete dto.coSignerId;
  dto.coSignerConsentStatus = loan.coSignerConsentStatus ?? null;
  return dto;
}

function PortalPaymentDto(payment) {
  return {
    id: payment.id,
    loanId: payment.loanId,
    loanReference: payment.Loan ? payment.Loan.referenceCode : null,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.paymentMethod,
    externalRef: payment.externalRef,
    transactionDate: payment.transactionDate,
    paymentDate: payment.paymentDate,
    status: payment.status,
    appliedToPrincipal: payment.appliedToPrincipal,
    appliedToInterest: payment.appliedToInterest,
    appliedToPenalty: payment.appliedToPenalty ?? 0,
    appliedToDownPayment: payment.appliedToDownPayment ?? 0,
    createdAt: payment.createdAt ?? payment.created_at,
  };
}

/** Shape shared by the portal (own reports) and staff review screens. */
function PaymentReportDto(report, { forStaff = false } = {}) {
  const dto = {
    id: report.id,
    loanId: report.loanId,
    loanReference: report.loan ? report.loan.referenceCode : null,
    amount: report.amount,
    currency: report.currency,
    transactionDate: report.transactionDate,
    paymentMethod: report.paymentMethod,
    externalRef: report.externalRef,
    payerPhone: report.payerPhone,
    notes: report.notes,
    status: report.status,
    reviewedAt: report.reviewedAt,
    reviewNotes: report.reviewNotes,
    paymentId: report.paymentId,
    // Models declare createdAt: 'created_at', so the attribute is exposed as created_at.
    createdAt: report.createdAt ?? report.created_at,
    updatedAt: report.updatedAt ?? report.updated_at,
  };
  if (forStaff) {
    dto.clientId = report.clientId;
    dto.client = report.client
      ? {
          id: report.client.id,
          firstName: report.client.firstName,
          lastName: report.client.lastName,
          accountNumber: report.client.accountNumber,
          phone: report.client.phone,
        }
      : null;
    dto.loan = report.loan
      ? {
          id: report.loan.id,
          referenceCode: report.loan.referenceCode,
          status: report.loan.status,
          currency: report.loan.currency,
          outstandingBalance: report.loan.outstandingBalance,
        }
      : null;
    dto.originalSubmission = report.originalSubmission;
    dto.reviewedBy = report.reviewedBy;
    dto.reviewer = report.reviewer
      ? {
          id: report.reviewer.id,
          name: [report.reviewer.first_name, report.reviewer.last_name].filter(Boolean).join(' ') || report.reviewer.email,
        }
      : null;
  }
  return dto;
}

function PortalLoanProductDto(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    currency: product.currency,
    minLoanAmount: product.minLoanAmount,
    maxLoanAmount: product.maxLoanAmount,
    interestRate: product.interestRate,
    interestType: product.interestType,
    interestRatePeriod: product.interestRatePeriod ?? 'annual',
    repaymentPeriodMonths: product.repaymentPeriodMonths,
    fees: product.fees,
    minimumDownPayment: product.minimumDownPayment ?? 0,
    downPaymentType: product.downPaymentType ?? 'amount',
    requiresCoSigner: Boolean(product.requiresCoSigner),
    // Collateral has to be captured and verified by staff; co-signers can be nominated in the portal.
    selfServiceAvailable: !product.requiresCollateral,
  };
}

module.exports = {
  PortalProfileDto,
  PortalCreditScoreDto,
  PortalLoanDto,
  PortalPaymentDto,
  PaymentReportDto,
  PortalLoanProductDto,
};

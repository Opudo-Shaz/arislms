// dtos/loan/LoanResponseDTO.js
const RepaymentScheduleResponseDto = require('../repaymentSchedule/RepaymentScheduleResponseDto');
const CreditScoreResponseDto = require('../creditScore/CreditScoreResponseDto');

// Statuses whose remaining amount still contributes to what the borrower owes.
const OUTSTANDING_SCHEDULE_STATUSES = ['pending', 'overdue', 'partial'];

/**
 * Total amount still owed on the loan, including interest (and fees), derived
 * from the repayment schedule. Falls back to the principal-only
 * outstandingBalance when the schedule is not loaded (e.g. before disbursement).
 */
function computeTotalOutstanding(loan) {
  if (!Array.isArray(loan.repaymentSchedules) || loan.repaymentSchedules.length === 0) {
    return loan.outstandingBalance != null ? Number(loan.outstandingBalance) : null;
  }

  const total = loan.repaymentSchedules.reduce((sum, s) => {
    if (!OUTSTANDING_SCHEDULE_STATUSES.includes(s.status)) return sum;
    const installmentOwed = Number(s.totalAmount || 0) - Number(s.paidAmount || 0);
    const penaltyOwed = Number(s.penaltyAmount || 0) - Number(s.penaltyPaid || 0);
    return sum + Math.max(0, installmentOwed) + Math.max(0, penaltyOwed);
  }, 0);

  return Number(total.toFixed(2));
}

function LoanResponseDto(loan) {
  return {
    id: loan.id,
    clientId: loan.clientId,
    client: loan.client
      ? { id: loan.client.id, firstName: loan.client.firstName, lastName: loan.client.lastName }
      : null,
    loanProductId: loan.loanProductId,
    principalAmount: loan.principalAmount,
    currency: loan.currency,
    interestRate: loan.interestRate,
    interestType: loan.interestType,
    termMonths: loan.termMonths,
    startDate: loan.startDate,
    endDate: loan.endDate,
    disbursementDate: loan.disbursementDate,
    approvalDate: loan.approvalDate,
    installmentAmount: loan.installmentAmount,
    outstandingBalance: loan.outstandingBalance,
    totalOutstandingBalance: computeTotalOutstanding(loan),
    amountRepaid: loan.amountRepaid,
    noOfRepayments: loan.noOfRepayments,
    fees: loan.fees,
    penalties: loan.penalties,
    downPaymentRequired: loan.downPaymentRequired,
    downPaymentPaid: loan.downPaymentPaid,
    collateral: loan.collateral,
    coSignerId: loan.coSignerId ?? null,
    coSigner: loan.coSigner
      ? { id: loan.coSigner.id, firstName: loan.coSigner.firstName, lastName: loan.coSigner.lastName }
      : null,
    collaterals: loan.collaterals
      ? loan.collaterals.map((collateral) => (typeof collateral.toJSON === 'function' ? collateral.toJSON() : collateral))
      : [],
    status: loan.status,
    referenceCode: loan.referenceCode,
    creditScore: loan.creditScore
      ? new CreditScoreResponseDto(loan.creditScore)
      : null,
    repaymentSchedules: loan.repaymentSchedules
      ? RepaymentScheduleResponseDto.fromArray(loan.repaymentSchedules)
      : [],
    transactions: loan.transactions
      ? loan.transactions.map((t) => (typeof t.toJSON === 'function' ? t.toJSON() : t))
      : [],
    approvedBy: loan.approvedByName ?? null,
    disbursedBy: loan.disbursedByName ?? null,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt
  };
}

LoanResponseDto.fromArray = function fromArray(loans) {
  return loans.map((loan) => LoanResponseDto(loan));
};

module.exports = LoanResponseDto;


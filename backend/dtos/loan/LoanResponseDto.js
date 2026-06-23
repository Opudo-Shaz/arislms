// dtos/loan/LoanResponseDTO.js
const RepaymentScheduleResponseDto = require('../repaymentSchedule/RepaymentScheduleResponseDto');
const CreditScoreResponseDto = require('../creditScore/CreditScoreResponseDto');

function LoanResponseDto(loan) {
  return {
    id: loan.id,
    clientId: loan.clientId,
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
    amountRepaid: loan.amountRepaid,
    noOfRepayments: loan.noOfRepayments,
    fees: loan.fees,
    penalties: loan.penalties,
    collateral: loan.collateral,
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


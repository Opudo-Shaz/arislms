// dtos/loan/LoanResponseDTO.js
const RepaymentScheduleResponseDto = require('../repaymentSchedule/RepaymentScheduleResponseDto');

class LoanResponseDto {
  constructor(loan) {
    this.id = loan.id;
    this.clientId = loan.clientId;
    this.loanProductId = loan.loanProductId;
    this.principalAmount = loan.principalAmount;
    this.currency = loan.currency;
    this.interestRate = loan.interestRate;
    this.interestType = loan.interestType;
    this.termMonths = loan.termMonths;
    this.startDate = loan.startDate;
    this.endDate = loan.endDate;
    this.disbursementDate = loan.disbursementDate;
    this.approvalDate = loan.approvalDate;
    this.installmentAmount = loan.installmentAmount;
    this.outstandingBalance = loan.outstandingBalance;
    this.totalPayments = loan.totalPayments;
    this.paymentsMade = loan.paymentsMade;
    this.fees = loan.fees;
    this.penalties = loan.penalties;
    this.collateral = loan.collateral;
    this.status = loan.status;
    this.referenceCode = loan.referenceCode;
    this.repaymentSchedules = loan.repaymentSchedules 
      ? RepaymentScheduleResponseDto.fromArray(loan.repaymentSchedules)
      : [];
    this.createdAt = loan.createdAt;
    this.updatedAt = loan.updatedAt;
  }
}

module.exports = LoanResponseDto;

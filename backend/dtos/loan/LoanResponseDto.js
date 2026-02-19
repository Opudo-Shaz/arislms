// dtos/loan/LoanResponseDTO.js
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
    this.actualFullRepaymentDate = loan.actualFullRepaymentDate;
    this.installmentAmount = loan.installmentAmount;
    this.outstandingBalance = loan.outstandingBalance;
    this.totalPayments = loan.totalPayments;
    this.paymentsMade = loan.paymentsMade;
    this.fees = loan.fees;
    this.penalties = loan.penalties;
    this.collateral = loan.collateral;
    this.status = loan.status;
    this.referenceCode = loan.referenceCode;
    this.paymentSchedule = loan.paymentSchedule;
    this.createdAt = loan.createdAt;
    this.updatedAt = loan.updatedAt;
  }
}

module.exports = LoanResponseDto;

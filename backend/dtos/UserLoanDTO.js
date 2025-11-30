class UserLoanDTO {
  constructor(loan) {
    this.id = loan.id;
    this.principalAmount = loan.principalAmount;
    this.currency = loan.currency;
    this.interestRate = loan.interestRate;
    this.interestType = loan.interestType;
    this.termMonths = loan.termMonths;
    this.startDate = loan.startDate;
    this.endDate = loan.endDate;
    this.installmentAmount = loan.installmentAmount;
    this.outstandingBalance = loan.outstandingBalance;
    this.paymentsMade = loan.paymentsMade;
    this.status = loan.status;
    this.referenceCode = loan.referenceCode;
    this.paymentSchedule = loan.paymentSchedule; 
  }
}

module.exports = UserLoanDTO;

// dtos/loanProduct/LoanProductResponseDTO.js
class LoanProductResponseDto {
  constructor(product) {
    this.id = product.id;
    this.name = product.name;
    this.description = product.description;
    this.currency = product.currency;
    this.minLoanAmount = product.minLoanAmount;
    this.maxLoanAmount = product.maxLoanAmount;
    this.minAmount = product.minLoanAmount;
    this.maxAmount = product.maxLoanAmount;
    this.interestRate = product.interestRate;
    this.interestType = product.interestType;
    this.repaymentPeriodMonths = product.repaymentPeriodMonths;
    this.termMonths = product.repaymentPeriodMonths;
    this.repaymentFrequency = product.repaymentFrequency || null;
    this.fees = product.fees;
    this.requiresCollateral = product.requiresCollateral;
    this.allowedCollateralTypes = product.allowedCollateralTypes || [];
    this.status = product.status;
    this.createdAt = product.createdAt;
    this.updatedAt = product.updatedAt;
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = LoanProductResponseDto;

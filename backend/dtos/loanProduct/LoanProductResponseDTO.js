// dtos/loanProduct/LoanProductResponseDTO.js
class LoanProductResponseDTO {
  constructor(product) {
    this.id = product.id;
    this.name = product.name;
    this.description = product.description;
    this.currency = product.currency;
    this.minAmount = product.minAmount;
    this.maxAmount = product.maxAmount;
    this.interestRate = product.interestRate;
    this.interestType = product.interestType;
    this.termMonths = product.termMonths;
    this.repaymentFrequency = product.repaymentFrequency;
    this.fees = product.fees;
    this.status = product.status;
    this.createdAt = product.createdAt;
    this.updatedAt = product.updatedAt;
  }
}

module.exports = LoanProductResponseDTO;

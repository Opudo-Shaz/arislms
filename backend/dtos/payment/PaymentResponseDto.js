// dtos/payment/PaymentResponseDTO.js
class PaymentResponseDto {
  constructor(model) {
    this.id = model.id;
    this.loanId = model.loan_id;
    this.amount = model.amount;
    this.paymentDate = model.payment_date;
    this.method = model.method;
    this.status = model.status;
    this.createdAt = model.created_at;
  }
}

module.exports = PaymentResponseDto;

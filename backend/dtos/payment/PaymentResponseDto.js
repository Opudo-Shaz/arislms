// dtos/payment/PaymentResponseDTO.js
class PaymentResponseDto {
  constructor(model) {
    this.id = model.id;
    this.loanId = model.loanId;
    this.amount = model.amount;
    this.currency = model.currency;
    this.method = model.paymentMethod;
    this.externalRef = model.externalRef;
    this.payerName = model.payerName;
    this.payerPhone = model.payerPhone;
    this.transactionDate = model.transactionDate;
    this.paymentDate = model.paymentDate;
    this.status = model.status;
    this.appliedToPrincipal = model.appliedToPrincipal;
    this.appliedToInterest = model.appliedToInterest;
    this.fees = model.fees;
    this.penalties = model.penalties;
    this.notes = model.notes;
    this.processedBy = model.processedBy;

    const processor = model.User;
    this.processedByUser = processor
      ? {
          id: processor.id,
          name: [processor.first_name, processor.last_name].filter(Boolean).join(' ').trim() || null,
          email: processor.email,
        }
      : null;

    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
  }
}

module.exports = PaymentResponseDto;

class RepaymentScheduleResponseDto {
  constructor(schedule) {
    if (!schedule) return;

    this.id = schedule.id;
    this.loanId = schedule.loanId;
    this.installmentNumber = schedule.installmentNumber;
    this.dueDate = schedule.dueDate;
    this.principalAmount = parseFloat(schedule.principalAmount);
    this.interestAmount = parseFloat(schedule.interestAmount);
    this.totalAmount = parseFloat(schedule.totalAmount);
    this.paidAmount = parseFloat(schedule.paidAmount || 0);
    this.paidDate = schedule.paidDate;
    this.status = schedule.status;
    this.remainingBalance = parseFloat(schedule.remainingBalance);
    this.notes = schedule.notes;
    this.createdAt = schedule.createdAt;
    this.updatedAt = schedule.updatedAt;
  }

  static fromModel(schedule) {
    return new RepaymentScheduleResponseDto(schedule);
  }

  static fromArray(schedules) {
    return schedules.map(schedule => new RepaymentScheduleResponseDto(schedule));
  }
}

module.exports = RepaymentScheduleResponseDto;

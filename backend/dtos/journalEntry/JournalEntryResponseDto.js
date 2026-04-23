class JournalEntryResponseDto {
  constructor(entry) {
    this.id = entry.id;
    this.reference = entry.reference;
    this.entryDate = entry.entryDate;
    this.description = entry.description;
    this.status = entry.status;
    this.sourceType = entry.sourceType;
    this.sourceId = entry.sourceId;
    this.reversalOfId = entry.reversalOfId;
    this.createdBy = entry.createdBy;
    this.createdAt = entry.created_at;

    if (entry.lines) {
      this.lines = entry.lines.map(l => ({
        id: l.id,
        accountCode: l.account ? l.account.code : null,
        accountName: l.account ? l.account.name : null,
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description,
        loanId: l.loanId,
        clientId: l.clientId,
      }));
    }
  }
}

module.exports = JournalEntryResponseDto;

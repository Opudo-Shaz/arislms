class ChartOfAccountResponseDto {
  constructor(account) {
    this.id = account.id;
    this.code = account.code;
    this.name = account.name;
    this.type = account.type;
    this.normalBalance = account.normalBalance;
    this.description = account.description;
    this.isActive = account.isActive;
    this.parentAccountId = account.parentAccountId;
    this.createdAt = account.created_at;
    this.updatedAt = account.updated_at;

    if (account.subAccounts) {
      this.subAccounts = account.subAccounts.map(s => new ChartOfAccountResponseDto(s));
    }
  }
}

module.exports = ChartOfAccountResponseDto;

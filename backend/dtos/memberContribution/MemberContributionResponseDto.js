class MemberContributionResponseDto {
  constructor(contribution) {
    this.id = contribution.id;
    this.clientId = contribution.clientId;
    this.amount = Number(contribution.amount);
    this.contributionDate = contribution.contributionDate;
    this.type = contribution.type;
    this.notes = contribution.notes;
    this.journalEntryId = contribution.journalEntryId;
    this.createdBy = contribution.createdBy;
    this.createdAt = contribution.created_at;

    if (contribution.client) {
      this.client = {
        id: contribution.client.id,
        firstName: contribution.client.firstName,
        lastName: contribution.client.lastName,
      };
    }
  }
}

module.exports = MemberContributionResponseDto;

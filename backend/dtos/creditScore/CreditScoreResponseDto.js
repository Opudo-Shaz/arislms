// dtos/creditScore/CreditScoreResponseDto.js
class CreditScoreResponseDto {
  constructor(creditScore) {
    this.id = creditScore.id;
    this.clientId = creditScore.clientId;
    this.loanId = creditScore.loanId;
    this.riskScore = creditScore.riskScore;
    this.riskGrade = creditScore.riskGrade;
    this.riskDti = creditScore.riskDti;
    this.scoringBreakdown = creditScore.scoringBreakdown;
    this.scoringModelVersion = creditScore.scoringModelVersion;
    this.evaluatedBy = creditScore.evaluatedBy;
    this.notes = creditScore.notes;
    this.createdAt = creditScore.createdAt;
    this.updatedAt = creditScore.updatedAt;
  }

  static fromArray(scoreArray) {
    if (!Array.isArray(scoreArray)) return [];
    return scoreArray.map(item => new CreditScoreResponseDto(item));
  }
}

module.exports = CreditScoreResponseDto;

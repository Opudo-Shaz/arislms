// dtos/loanScoring/LoanScoringResponseDto.js

class LoanScoringResponseDto {
  constructor(scoring) {
    if (!scoring) return null;
    
    this.riskScore = scoring.riskScore;
    this.riskGrade = scoring.riskGrade;
    this.riskDti = scoring.riskDti;
    this.scoringModelVersion = scoring.scoringModelVersion;
    this.scoringBreakdown = scoring.scoringBreakdown;
    this.evaluatedAt = scoring.createdAt || new Date();
  }

  static fromArray(scoringArray) {
    if (!Array.isArray(scoringArray)) return [];
    return scoringArray.map(item => new LoanScoringResponseDto(item));
  }

  static fromLoan(loan) {
    if (!loan || !loan.riskScore) return null;
    
    return new LoanScoringResponseDto({
      riskScore: loan.riskScore,
      riskGrade: loan.riskGrade,
      riskDti: loan.riskDti,
      scoringModelVersion: loan.scoringModelVersion,
      scoringBreakdown: loan.scoringBreakdown,
      createdAt: loan.createdAt
    });
  }
}

module.exports = LoanScoringResponseDto;

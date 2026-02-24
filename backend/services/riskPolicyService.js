// services/riskPolicy.js

function getRiskGrade(score) {
  if (score >= 5) return "A";
  if (score >= 4) return "B";
  if (score >= 3) return "C";
  if (score >= 2) return "D";
  return "E";
}

function getDecisionFromScore(score) {
  if (score >= 4) return "APPROVED";
  if (score >= 3) return "MANUAL_REVIEW";
  return "REJECTED";
}

function getMaxLoanMultiplier(score) {
  // Used later if you want amount limits
  if (score >= 5) return 5;
  if (score >= 4) return 3;
  if (score >= 3) return 2;
  return 1;
}

module.exports = {
  getRiskGrade,
  getDecisionFromScore,
  getMaxLoanMultiplier
};

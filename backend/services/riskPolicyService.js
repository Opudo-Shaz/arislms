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

function getMaxLoanAmount(score, baseAmount) {
  const multiplier = getMaxLoanMultiplier(score);
  return baseAmount * multiplier;
}

/**
 * Determines the credit limit for a client based on their income band and risk score.
 *
 * CLIENT_INCOME_BANDS env format: "0-10000,10001-30000,30001-50000,50001-100000+"
 * BASE_MULIPLIER_AMOUNT env format: "5000"
 *
 * Formula: (bandIndex + 1) * BASE_MULIPLIER_AMOUNT * getMaxLoanMultiplier(riskScore)
 */
function computeCreditLimit(monthlyIncome, riskScore) {
  const income = Number(monthlyIncome) || 0;
  const baseMultiplier = Number(process.env.BASE_MULIPLIER_AMOUNT) || 5000;
  const bandsRaw = (process.env.CLIENT_INCOME_BANDS || '').split(',').map(b => b.trim()).filter(Boolean);

  // Parse each band into { lower, upper } — "100000+" treated as open-ended upper
  const bands = bandsRaw.map(band => {
    const parts = band.replace('+', '').split('-');
    return {
      lower: Number(parts[0]),
      upper: parts[1] !== undefined ? Number(parts[1]) : Infinity
    };
  });

  // Find the matching band index
  let bandIndex = bands.length - 1; // default to highest
  for (let i = 0; i < bands.length; i++) {
    if (income <= bands[i].upper) {
      bandIndex = i;
      break;
    }
  }

  const base = (bandIndex + 1) * baseMultiplier;
  return base * getMaxLoanMultiplier(riskScore);
}

module.exports = {
  getRiskGrade,
  getDecisionFromScore,
  getMaxLoanMultiplier,
  getMaxLoanAmount,
  computeCreditLimit
};

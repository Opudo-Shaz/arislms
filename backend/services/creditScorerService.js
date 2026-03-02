// services/creditScorer.js

function clamp(value, min = 0, max = 5) {
  return Math.max(min, Math.min(max, value));
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function calculateCreditScore(client = {}, loans = [], options = {}) {
  const breakdown = {
    base: 2.5,
    income: 0,
    debt: 0,
    repaymentHistory: 0,
    kyc: 0,
    age: 0,
    tenure: 0,
    blendedPreviousScore: 0
  };

  let score = breakdown.base;

  const income = Number(client.monthlyIncome) || 0;
  const requestedTenure = Number(options.requestedTenure) || 12;

  // 1. Income strength
  if (income >= 50000) breakdown.income = 1.0;
  else if (income >= 30000) breakdown.income = 0.6;
  else if (income >= 10000) breakdown.income = 0.3;

  score += breakdown.income;

  // 2. Debt burden (DTI)
  const totalOutstanding = loans.reduce(
    (sum, l) => sum + Number(l.outstandingBalance || 0),
    0
  );

  const dti = income > 0 ? totalOutstanding / income : Infinity;

  if (income > 0) {
    if (dti < 0.2) breakdown.debt = 1.0;
    else if (dti < 0.5) breakdown.debt = 0.6;
    else if (dti < 1) breakdown.debt = 0.2;
    else breakdown.debt = -1.0;
  } else {
    breakdown.debt = -0.5;
  }

  score += breakdown.debt;

  // 3. Repayment history
  const missedPayments = loans.reduce(
    (sum, l) => sum + Number(l.missedPayments || 0),
    0
  );

  if (missedPayments === 0 && loans.length > 0) {
    breakdown.repaymentHistory = 0.8;
  } else if (missedPayments > 0) {
    breakdown.repaymentHistory = -Math.min(2.0, missedPayments * 0.7);
  }

  score += breakdown.repaymentHistory;

  // 4. KYC
  if (
    client.kycStatus &&
    String(client.kycStatus).toLowerCase().includes("verified")
  ) {
    breakdown.kyc = 0.5;
  }

  score += breakdown.kyc;

  // 5. Age stability
  const age = calculateAge(client.dateOfBirth);

  if (age !== null) {
    if (age >= 25 && age <= 60) breakdown.age = 0.2;
    else if (age < 21 || age > 75) breakdown.age = -0.5;
  }

  score += breakdown.age;

  // 6. Tenure risk
  if (requestedTenure <= 6) breakdown.tenure = 0.3;
  else if (requestedTenure > 18) breakdown.tenure = -0.5;

  score += breakdown.tenure;

  // 7. Blend previous stored risk score
  const previousScore = Number(client.riskScore);

  if (
    !Number.isNaN(previousScore) &&
    previousScore >= 0 &&
    previousScore <= 5
  ) {
    breakdown.blendedPreviousScore = previousScore;
    score = score * 0.7 + previousScore * 0.3;
  }

  score = clamp(Math.round(score), 0, 5);

  return {
    score,
    breakdown,
    dti
  };
}

module.exports = { calculateCreditScore };

/**
 * Cost-of-credit disclosure for a loan: what the borrower receives, what they
 * repay and the total cost. Mirrored in frontend/src/utils/loanCost.js — keep in sync.
 */
const { generateAmortizationSchedule } = require('./loanCalculator');
const FeeTreatment = require('../enums/feeTreatment');

const round2 = (n) => Number(Number(n).toFixed(2));

/**
 * Loan principal for a requested amount: fees added to principal are financed
 * on top of what the client asked for.
 */
function resolvePrincipal(requestedAmount, fees, feeTreatment) {
  const amount = Number(requestedAmount) || 0;
  return feeTreatment === FeeTreatment.ADDED_TO_PRINCIPAL
    ? round2(amount + (Number(fees) || 0))
    : round2(amount);
}

// Nominal annual rate (monthly IRR × 12) of the borrower's cash flows.
function computeApr(netAdvance, installments) {
  if (!Number.isFinite(netAdvance) || netAdvance <= 0 || installments.length === 0) return null;
  const npv = (r) => installments.reduce((s, amt, i) => s + amt / Math.pow(1 + r, i + 1), 0) - netAdvance;
  if (npv(0) <= 0) return 0;
  let lo = 0;
  let hi = 1;
  while (npv(hi) > 0 && hi < 1e6) hi *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return round2(((lo + hi) / 2) * 12 * 100);
}

/**
 * @param {Object} p
 * @param {number} p.principalAmount - Loan principal (already includes fees when added to principal)
 * @param {number} [p.fees=0]
 * @param {string} [p.feeTreatment='deducted']
 * @param {number} [p.downPayment=0]
 * @param {number} p.interestRate
 * @param {string} p.interestType
 * @param {string} [p.interestRatePeriod='annual']
 * @param {number} p.termMonths
 * @returns {Object|null}
 */
function computeLoanCostDisclosure({
  principalAmount,
  fees = 0,
  feeTreatment = FeeTreatment.DEDUCTED,
  downPayment = 0,
  interestRate,
  interestType,
  interestRatePeriod = 'annual',
  termMonths,
}) {
  const principal = Number(principalAmount) || 0;
  const fee = Number(fees) || 0;
  const dp = Number(downPayment) || 0;
  const term = Number(termMonths) || 0;
  if (principal <= 0 || term <= 0) return null;

  const financed = round2(principal - dp);
  const schedule = financed > 0
    ? generateAmortizationSchedule({
        principal: financed,
        interestRate,
        termMonths: term,
        interestType,
        interestRatePeriod,
        startDate: new Date(),
      })
    : [];

  const totalInterest = round2(schedule.reduce((s, r) => s + r.interestAmount, 0));
  const totalRepayable = round2(schedule.reduce((s, r) => s + r.totalAmount, 0));
  const netDisbursement = round2(principal - fee);
  const totalCostOfCredit = round2(totalInterest + fee);
  const netCreditAdvanced = round2(netDisbursement - dp);

  return {
    feeTreatment,
    requestedAmount: feeTreatment === FeeTreatment.ADDED_TO_PRINCIPAL ? netDisbursement : round2(principal),
    principalAmount: round2(principal),
    fees: round2(fee),
    netDisbursement,
    downPayment: round2(dp),
    installmentAmount: schedule.length ? schedule[0].totalAmount : null,
    totalInterest,
    totalRepayable,
    totalCostOfCredit,
    effectiveRatePercent: netCreditAdvanced > 0 ? round2((totalCostOfCredit / netCreditAdvanced) * 100) : null,
    aprPercent: computeApr(netCreditAdvanced, schedule.map((r) => r.totalAmount)),
    termMonths: term,
  };
}

/** Disclosure for a persisted loan (uses the collected down payment once disbursed). */
function disclosureForLoan(loan) {
  return computeLoanCostDisclosure({
    principalAmount: loan.principalAmount,
    fees: loan.fees,
    feeTreatment: loan.feeTreatment || FeeTreatment.DEDUCTED,
    downPayment: loan.disbursementDate ? loan.downPaymentPaid : loan.downPaymentRequired,
    interestRate: loan.interestRate,
    interestType: loan.interestType,
    interestRatePeriod: loan.interestRatePeriod || 'annual',
    termMonths: loan.termMonths,
  });
}

module.exports = { resolvePrincipal, computeLoanCostDisclosure, disclosureForLoan };

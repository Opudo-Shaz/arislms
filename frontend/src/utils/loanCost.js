/**
 * Loan cost-of-credit preview. Mirrors backend/utils/loanCostDisclosure.js and
 * backend/utils/loanCalculator.js — keep in sync.
 *
 * @module utils/loanCost
 */

export const FEE_TREATMENT = {
  DEDUCTED: 'deducted',
  ADDED_TO_PRINCIPAL: 'added_to_principal',
}

const round2 = (n) => Number(Number(n).toFixed(2))

const toMonthlyRate = (rate, period = 'annual') => {
  const r = Number(rate) / 100
  return period === 'monthly' ? r : r / 12
}

/** Per-installment { interest, total } rows, same rounding as the backend schedule. */
const buildInstallments = (P, interestRate, n, interestType, interestRatePeriod) => {
  const r = toMonthlyRate(interestRate, interestRatePeriod)
  if (interestType === 'flat') {
    const totalInterest = P * r * n
    return Array.from({ length: n }, () => ({
      interest: round2(totalInterest / n),
      total: round2((P + totalInterest) / n),
    }))
  }
  const payment = !interestRate || !r
    ? Number((P / n).toFixed(2))
    : Number(((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)).toFixed(2))
  const rows = []
  let balance = P
  for (let i = 1; i <= n; i++) {
    const interest = balance * r
    const principalPart = payment - interest
    balance -= principalPart
    const finalPrincipal = i === n ? principalPart + balance : principalPart
    rows.push({ interest: round2(interest), total: round2(finalPrincipal + interest) })
  }
  return rows
}

const computeApr = (netAdvance, installments) => {
  if (!Number.isFinite(netAdvance) || netAdvance <= 0 || installments.length === 0) return null
  const npv = (r) => installments.reduce((s, amt, i) => s + amt / Math.pow(1 + r, i + 1), 0) - netAdvance
  if (npv(0) <= 0) return 0
  let lo = 0
  let hi = 1
  while (npv(hi) > 0 && hi < 1e6) hi *= 2
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (npv(mid) > 0) lo = mid
    else hi = mid
  }
  return round2(((lo + hi) / 2) * 12 * 100)
}

/** Down payment a product requires for a given principal (mirrors loanService.computeDownPayment). */
export const productDownPayment = (product, principal) => {
  const value = Number(product?.minimumDownPayment ?? 0)
  if (!value || value <= 0) return 0
  return product.downPaymentType === 'percentage'
    ? round2((Number(principal) * value) / 100)
    : round2(value)
}

/**
 * Cost disclosure for a requested amount under a product and fee treatment.
 * @returns {Object|null} same shape as the API's `loan.costDisclosure`
 */
export const computeLoanCost = ({ product, requestedAmount, termMonths, feeTreatment = FEE_TREATMENT.DEDUCTED }) => {
  const amount = Number(requestedAmount) || 0
  const term = Number(termMonths) || 0
  if (!product || amount <= 0 || term <= 0) return null

  const fee = Number(product.fees) || 0
  const principal = feeTreatment === FEE_TREATMENT.ADDED_TO_PRINCIPAL ? round2(amount + fee) : round2(amount)
  const dp = productDownPayment(product, principal)
  const financed = round2(principal - dp)
  const rows = financed > 0
    ? buildInstallments(financed, product.interestRate, term, product.interestType, product.interestRatePeriod || 'annual')
    : []

  const totalInterest = round2(rows.reduce((s, r) => s + r.interest, 0))
  const totalRepayable = round2(rows.reduce((s, r) => s + r.total, 0))
  const netDisbursement = round2(principal - fee)
  const totalCostOfCredit = round2(totalInterest + fee)
  const netCreditAdvanced = round2(netDisbursement - dp)

  return {
    feeTreatment,
    requestedAmount: round2(amount),
    principalAmount: principal,
    fees: round2(fee),
    netDisbursement,
    downPayment: dp,
    installmentAmount: rows.length ? rows[0].total : null,
    totalInterest,
    totalRepayable,
    totalCostOfCredit,
    effectiveRatePercent: netCreditAdvanced > 0 ? round2((totalCostOfCredit / netCreditAdvanced) * 100) : null,
    aprPercent: computeApr(netCreditAdvanced, rows.map((r) => r.total)),
    termMonths: term,
  }
}

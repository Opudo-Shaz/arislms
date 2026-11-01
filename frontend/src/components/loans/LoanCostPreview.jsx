/**
 * Cost-of-credit disclosure UI: fee-treatment choice with side-by-side amounts
 * and a summary of what the borrower receives, repays and pays in total.
 *
 * @module components/loans/LoanCostPreview
 */

import React from 'react'
import { CCol, CFormCheck, CRow } from '@coreui/react'
import { formatCurrency } from '../../utils/format'
import { computeLoanCost, FEE_TREATMENT } from '../../utils/loanCost'

const OPTIONS = [
  {
    value: FEE_TREATMENT.DEDUCTED,
    label: 'Deduct fees from the loan',
    hint: 'Fees are taken from the amount sent out.',
  },
  {
    value: FEE_TREATMENT.ADDED_TO_PRINCIPAL,
    label: 'Add fees to the loan',
    hint: 'Full amount is sent out; fees are repaid with interest.',
  },
]

const Row = ({ label, children, strong }) => (
  <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
    <span className="text-body-secondary">{label}</span>
    <span className={strong ? 'fw-semibold' : undefined}>{children}</span>
  </div>
)

/** Summary table for a disclosure object (form preview or `loan.costDisclosure`). */
export const LoanCostSummary = ({ cost, currency, receiverLabel = 'Amount received' }) => {
  if (!cost) return null
  const money = (v) => formatCurrency(v, currency)
  const feeNote = cost.feeTreatment === FEE_TREATMENT.ADDED_TO_PRINCIPAL ? ' (added to loan)' : ' (deducted upfront)'
  return (
    <div className="small">
      <Row label="Loan principal">{money(cost.principalAmount)}</Row>
      <Row label="Fees">
        {money(cost.fees)}
        {Number(cost.fees) > 0 ? feeNote : ''}
      </Row>
      {Number(cost.downPayment) > 0 ? <Row label="Down payment">{money(cost.downPayment)}</Row> : null}
      <Row label={receiverLabel} strong>{money(cost.netDisbursement)}</Row>
      <Row label="Instalment">
        {money(cost.installmentAmount)} × {cost.termMonths} month{cost.termMonths === 1 ? '' : 's'}
      </Row>
      <Row label="Total interest">{money(cost.totalInterest)}</Row>
      <Row label="Total to repay" strong>{money(cost.totalRepayable)}</Row>
      <Row label="Total cost of credit (interest + fees)" strong>{money(cost.totalCostOfCredit)}</Row>
      <Row label="Cost as % of amount received">
        {cost.effectiveRatePercent != null ? `${cost.effectiveRatePercent}%` : '—'}
      </Row>
      <Row label="APR (annualised)">{cost.aprPercent != null ? `${cost.aprPercent}%` : '—'}</Row>
    </div>
  )
}

/**
 * Live preview shown under a loan application form.
 * @param {Object} props
 * @param {Object} props.product - selected loan product
 * @param {number|string} props.amount - amount the client asked to receive
 * @param {number|string} props.termMonths
 * @param {string} props.feeTreatment
 * @param {(value: string) => void} props.onFeeTreatmentChange
 * @param {string} [props.receiverLabel]
 */
const LoanCostPreview = ({
  product,
  amount,
  termMonths,
  feeTreatment,
  onFeeTreatmentChange,
  receiverLabel = 'Amount received',
  idPrefix = 'fee-treatment',
}) => {
  if (!product) return null
  const currency = product.currency || 'KES'
  const hasFees = Number(product.fees) > 0
  const costs = Object.fromEntries(
    OPTIONS.map((o) => [o.value, computeLoanCost({ product, requestedAmount: amount, termMonths, feeTreatment: o.value })]),
  )
  const selected = costs[hasFees ? feeTreatment : FEE_TREATMENT.DEDUCTED]
  const max = product.maxLoanAmount != null ? Number(product.maxLoanAmount) : null

  return (
    <div className="border rounded p-3 bg-body-tertiary">
      <div className="fw-semibold mb-2">Loan cost summary</div>
      {hasFees ? (
        <>
          <div className="small text-body-secondary mb-2">
            This product charges {formatCurrency(product.fees, currency)} in fees. Choose how they are paid:
          </div>
          <CRow className="g-2 mb-3">
            {OPTIONS.map((o) => {
              const c = costs[o.value]
              const overMax = c && max != null && c.principalAmount > max
              return (
                <CCol md={6} key={o.value}>
                  <div className={`border rounded p-2 h-100 bg-body ${feeTreatment === o.value ? 'border-primary' : ''}`}>
                    <CFormCheck
                      type="radio"
                      name={idPrefix}
                      id={`${idPrefix}-${o.value}`}
                      value={o.value}
                      checked={feeTreatment === o.value}
                      onChange={() => onFeeTreatmentChange(o.value)}
                      label={<span className="fw-semibold">{o.label}</span>}
                    />
                    <div className="small text-body-secondary mb-1">{o.hint}</div>
                    {c ? (
                      <div className="small">
                        <div>Loan principal: {formatCurrency(c.principalAmount, currency)}</div>
                        <div>{receiverLabel}: <strong>{formatCurrency(c.netDisbursement, currency)}</strong></div>
                        <div>Total to repay: <strong>{formatCurrency(c.totalRepayable, currency)}</strong></div>
                        <div>Cost of credit: {formatCurrency(c.totalCostOfCredit, currency)}</div>
                        {overMax ? (
                          <div className="text-danger mt-1">
                            Exceeds the product maximum of {formatCurrency(max, currency)}.
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="small text-body-secondary">Enter an amount and repayment period.</div>
                    )}
                  </div>
                </CCol>
              )
            })}
          </CRow>
        </>
      ) : null}
      {selected ? (
        <LoanCostSummary cost={selected} currency={currency} receiverLabel={receiverLabel} />
      ) : (
        <div className="small text-body-secondary">Enter an amount and repayment period to see the full cost.</div>
      )}
      <div className="small text-body-secondary mt-2">
        Estimate based on the product&apos;s current rate and fees; final figures are confirmed on disbursement.
      </div>
    </div>
  )
}

export default LoanCostPreview

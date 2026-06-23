const { Op } = require('sequelize');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const Loan = require('../models/loanModel');
const LoanStatus = require('../enums/loanStatus');

// Loans whose outstanding installments contribute to the portfolio.
const OUTSTANDING_LOAN_STATUSES = [
  LoanStatus.DISBURSED,
  LoanStatus.ACTIVE,
  LoanStatus.PARTIALLY_PAID,
  LoanStatus.OVERDUE,
  LoanStatus.DEFAULTED,
];

// Aging buckets keyed by days overdue relative to `asOf`.
// `Current` covers installments not yet due (daysOverdue <= 0).
const BUCKETS = [
  { label: 'Current', min: -Infinity, max: 0 },
  { label: '1-30', min: 1, max: 30 },
  { label: '31-60', min: 31, max: 60 },
  { label: '61-90', min: 61, max: 90 },
  { label: '90+', min: 91, max: Infinity },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketIndex(daysOverdue) {
  return BUCKETS.findIndex((b) => daysOverdue >= b.min && daysOverdue <= b.max);
}

/**
 * Portfolio aging: bucket outstanding repayment-schedule installments by how
 * many days overdue they are as of a given date. Single source of truth for the
 * days-overdue / bucket math (instead of shipping all loans+schedules to the client).
 *
 * @param {string} [asOfInput] - YYYY-MM-DD; defaults to today.
 * @returns {Promise<{asOf:string, buckets:Array, totals:Object}>}
 */
async function getPortfolioAging(asOfInput) {
  const asOf = startOfDay(asOfInput ? new Date(asOfInput) : new Date());

  const schedules = await RepaymentSchedule.findAll({
    where: { status: { [Op.ne]: 'paid' } },
    include: [
      {
        model: Loan,
        required: true,
        attributes: [],
        where: { status: { [Op.in]: OUTSTANDING_LOAN_STATUSES } },
      },
    ],
    attributes: ['principalAmount', 'totalAmount', 'paidAmount', 'dueDate'],
  });

  const buckets = BUCKETS.map((b) => ({ label: b.label, principalOutstanding: 0, count: 0 }));

  for (const s of schedules) {
    const total = Number(s.totalAmount) || 0;
    const paid = Number(s.paidAmount) || 0;
    const outstanding = total - paid;
    if (outstanding <= 0.005) continue;

    // Principal share of the still-outstanding amount for this installment.
    const principalRatio = total > 0 ? (Number(s.principalAmount) || 0) / total : 0;
    const principalOutstanding = outstanding * principalRatio;

    const daysOverdue = Math.floor((asOf - startOfDay(s.dueDate)) / DAY_MS);
    const idx = bucketIndex(daysOverdue);
    if (idx === -1) continue;

    buckets[idx].principalOutstanding += principalOutstanding;
    buckets[idx].count += 1;
  }

  let totalPrincipal = 0;
  let totalCount = 0;
  for (const b of buckets) {
    b.principalOutstanding = Number(b.principalOutstanding.toFixed(2));
    totalPrincipal += b.principalOutstanding;
    totalCount += b.count;
  }

  return {
    asOf: asOf.toISOString().slice(0, 10),
    buckets,
    totals: {
      principalOutstanding: Number(totalPrincipal.toFixed(2)),
      count: totalCount,
    },
  };
}

module.exports = { getPortfolioAging };

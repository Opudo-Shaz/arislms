const { Op } = require('sequelize');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const Loan = require('../models/loanModel');
const Payment = require('../models/paymentModel');
const LoanTransaction = require('../models/loanTransactionModel');
const MemberContribution = require('../models/memberContributionModel');
const Client = require('../models/clientModel');
const LoanStatus = require('../enums/loanStatus');
const LoanTransactionType = require('../enums/loanTransactionType');
const ClientStatus = require('../enums/clientStatus');

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

// ── Dashboard stats helpers ───────────────────────────────────────────────

const ACTIVE_LOAN_STATUSES = [LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.PARTIALLY_PAID];
const OVERDUE_LOAN_STATUSES = [LoanStatus.OVERDUE, LoanStatus.DEFAULTED];
const PENDING_LOAN_STATUSES = [
  LoanStatus.PENDING, LoanStatus.PENDING_REVERIFICATION, LoanStatus.VERIFIED,
  LoanStatus.IN_REVIEW, LoanStatus.UNDER_REVIEW,
];

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Returns YYYY-MM strings for the last 6 calendar months, oldest first. */
function last6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/**
 * Aggregate KPIs, loan status breakdown, monthly trends, and income vs
 * expenditure for the admin dashboard. All aggregation is done in JS over
 * Sequelize result sets (same pattern as getPortfolioAging).
 *
 * @returns {Promise<object>}
 */
async function getDashboardStats() {
  const now = new Date();
  const months = last6Months();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    allLoans,
    kycQueueCount,
    last6Payments,
    allContributions,
    last6Disbursements,
    agingData,
  ] = await Promise.all([
    Loan.findAll({
      attributes: ['status', 'principalAmount'],
      where: { status: { [Op.notIn]: [LoanStatus.DELETED, LoanStatus.CANCELLED] } },
    }),
    Client.count({ where: { status: ClientStatus.PENDING_KYC_REVERIFICATION } }),
    Payment.findAll({
      attributes: ['amount', 'appliedToInterest', 'fees', 'penalties', 'paymentDate'],
      where: {
        paymentDate: { [Op.gte]: sixMonthsAgo },
        status: 'completed',
      },
    }),
    MemberContribution.findAll({ attributes: ['amount', 'type'] }),
    LoanTransaction.findAll({
      attributes: ['amount', 'transactionDate'],
      where: {
        transactionType: LoanTransactionType.DISBURSEMENT,
        transactionDate: { [Op.gte]: sixMonthsAgo },
      },
    }),
    getPortfolioAging(),
  ]);

  // ── Loan KPIs & breakdown ──────────────────────────────────────────────────
  let activeCount = 0, activePrincipal = 0;
  let overdueCount = 0, overduePrincipal = 0;
  let pendingCount = 0;
  const statusMap = {};

  for (const loan of allLoans) {
    const s = loan.status;
    const p = Number(loan.principalAmount) || 0;
    if (!statusMap[s]) statusMap[s] = { count: 0, totalPrincipal: 0 };
    statusMap[s].count++;
    statusMap[s].totalPrincipal += p;
    if (ACTIVE_LOAN_STATUSES.includes(s)) { activeCount++; activePrincipal += p; }
    if (OVERDUE_LOAN_STATUSES.includes(s)) { overdueCount++; overduePrincipal += p; }
    if (PENDING_LOAN_STATUSES.includes(s)) pendingCount++;
  }

  const loanStatusBreakdown = Object.entries(statusMap).map(([status, v]) => ({
    status,
    count: v.count,
    totalPrincipal: Number(v.totalPrincipal.toFixed(2)),
  }));

  // ── Member savings net ─────────────────────────────────────────────────────
  let savingsIn = 0, savingsOut = 0;
  for (const c of allContributions) {
    const a = Number(c.amount) || 0;
    if (c.type === 'CONTRIBUTION' || c.type === 'OVERPAYMENT_CREDIT') savingsIn += a;
    else if (c.type === 'WITHDRAWAL') savingsOut += a;
  }

  // ── Payments this month ────────────────────────────────────────────────────
  let pmCount = 0, pmTotal = 0;
  for (const p of last6Payments) {
    if (new Date(p.paymentDate) >= startOfCurrentMonth) {
      pmCount++;
      pmTotal += Number(p.amount) || 0;
    }
  }

  // ── Monthly trends & financials ────────────────────────────────────────────
  const disbByMonth = {};
  const collByMonth = {};
  const incomeByMonth = {};

  for (const p of last6Payments) {
    const k = monthKey(p.paymentDate);
    collByMonth[k] = (collByMonth[k] || 0) + (Number(p.amount) || 0);
    incomeByMonth[k] = (incomeByMonth[k] || 0)
      + (Number(p.appliedToInterest) || 0)
      + (Number(p.fees) || 0)
      + (Number(p.penalties) || 0);
  }

  for (const t of last6Disbursements) {
    const k = monthKey(t.transactionDate);
    disbByMonth[k] = (disbByMonth[k] || 0) + (Number(t.amount) || 0);
  }

  const monthlyTrends = months.map((key) => ({
    month: key,
    disbursed: Number((disbByMonth[key] || 0).toFixed(2)),
    collected: Number((collByMonth[key] || 0).toFixed(2)),
  }));

  const monthlyFinancials = months.map((key) => ({
    month: key,
    income: Number((incomeByMonth[key] || 0).toFixed(2)),
    expenditure: Number((disbByMonth[key] || 0).toFixed(2)),
  }));

  return {
    kpis: {
      activePortfolio: { count: activeCount, totalPrincipal: Number(activePrincipal.toFixed(2)) },
      overdueLoans: { count: overdueCount, totalOutstanding: Number(overduePrincipal.toFixed(2)) },
      pendingApprovals: { count: pendingCount },
      kycQueue: { count: kycQueueCount },
      paymentsThisMonth: { count: pmCount, total: Number(pmTotal.toFixed(2)) },
      memberSavingsNet: { netBalance: Number((savingsIn - savingsOut).toFixed(2)) },
    },
    loanStatusBreakdown,
    monthlyTrends,
    monthlyFinancials,
    portfolioAging: { buckets: agingData.buckets, totals: agingData.totals },
  };
}

module.exports = { getPortfolioAging, getDashboardStats };

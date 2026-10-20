/**
 * repaymentReminderService — tiered client repayment reminders, driven by days past due (DPD)
 * of the oldest unpaid installment:
 *   upcoming  : N days before / on the due date (once per installment per offset)
 *   overdue   : DPD in [overdue.min_dpd, overdue.max_dpd], every overdue.interval_days
 *   defaulted : DPD in [defaulted.min_dpd, defaulted.max_dpd], every defaulted.interval_days
 *   beyond defaulted.max_dpd: silent (handled by collections staff)
 * All rows are queued with businessHoursOnly so delivery also respects the window.
 */
const { Op } = require('sequelize');
const Loan = require('../../models/loanModel');
const AuditLog = require('../../models/auditLogModel');
const User = require('../../models/userModel');
const NotificationOutbox = require('../../models/notificationOutboxModel');
const LoanStatus = require('../../enums/loanStatus');
const UserStatus = require('../../enums/userStatus');
const NotificationChannel = require('../../enums/notificationChannel');
const NotificationEventType = require('../../enums/notificationEventType');
const systemConfigService = require('../systemConfigService');
const penaltyService = require('../penaltyService');
const businessHours = require('../../utils/businessHours');
const { buildRecipients, safeNotify } = require('./notificationTriggers');
const logger = require('../../config/logger');

const Tier = Object.freeze({
  UPCOMING: 'upcoming',
  OVERDUE: 'overdue',
  DEFAULTED: 'defaulted',
  SILENT: 'silent',
  NONE: 'none',
});

const CLOSED_INSTALLMENT_STATUSES = new Set(['paid', 'written_off']);
const VALID_CHANNELS = new Set(Object.values(NotificationChannel));

const DEFAULT_ELIGIBLE_STATUSES = [
  LoanStatus.DISBURSED,
  LoanStatus.ACTIVE,
  LoanStatus.PARTIALLY_PAID,
  LoanStatus.OVERDUE,
  LoanStatus.DEFAULTED,
];

function sanitizeChannels(value, fallback) {
  const list = Array.isArray(value) ? value.filter((c) => VALID_CHANNELS.has(c)) : [];
  return list.length ? list : fallback;
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function getReminderConfig() {
  const get = (key, type, def) => systemConfigService.getConfigValue(`notification.reminders.${key}`, type, def);
  const [
    enabled, upcomingEnabled, daysBefore, upcomingChannels,
    overdueEnabled, overdueMin, overdueMax, overdueInterval, overdueChannels,
    defaultedEnabled, defaultedMin, defaultedMax, defaultedInterval, defaultedChannels,
    eligibleStatuses, batchSize, priority, notifyLoanOfficer,
  ] = await Promise.all([
    get('enabled', 'boolean', true),
    get('upcoming.enabled', 'boolean', true),
    get('upcoming.days_before', 'json', [3, 0]),
    get('upcoming.channels', 'json', ['sms', 'email', 'push']),
    get('overdue.enabled', 'boolean', true),
    get('overdue.min_dpd', 'number', 1),
    get('overdue.max_dpd', 'number', 30),
    get('overdue.interval_days', 'number', 5),
    get('overdue.channels', 'json', ['sms', 'email', 'push']),
    get('defaulted.enabled', 'boolean', true),
    get('defaulted.min_dpd', 'number', 31),
    get('defaulted.max_dpd', 'number', 60),
    get('defaulted.interval_days', 'number', 15),
    get('defaulted.channels', 'json', ['sms', 'email']),
    get('eligible_loan_statuses', 'json', DEFAULT_ELIGIBLE_STATUSES),
    get('batch_size', 'number', 200),
    get('priority', 'number', 0),
    get('notify_loan_officer', 'boolean', true),
  ]);

  const offsets = Array.isArray(daysBefore)
    ? [...new Set(daysBefore.map(Number).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b)
    : [3, 0];

  const validStatuses = new Set(Object.values(LoanStatus));
  const statuses = Array.isArray(eligibleStatuses)
    ? eligibleStatuses.filter((s) => validStatuses.has(s))
    : DEFAULT_ELIGIBLE_STATUSES;

  return {
    enabled,
    upcoming: {
      enabled: upcomingEnabled,
      offsets,
      channels: sanitizeChannels(upcomingChannels, ['sms', 'email', 'push']),
    },
    overdue: {
      enabled: overdueEnabled,
      minDpd: Math.max(1, toInt(overdueMin, 1)),
      maxDpd: toInt(overdueMax, 30),
      intervalDays: Math.max(1, toInt(overdueInterval, 5)),
      channels: sanitizeChannels(overdueChannels, ['sms', 'email', 'push']),
    },
    defaulted: {
      enabled: defaultedEnabled,
      minDpd: Math.max(1, toInt(defaultedMin, 31)),
      maxDpd: toInt(defaultedMax, 60),
      intervalDays: Math.max(1, toInt(defaultedInterval, 15)),
      channels: sanitizeChannels(defaultedChannels, ['sms', 'email']),
    },
    eligibleStatuses: statuses.length ? statuses : DEFAULT_ELIGIBLE_STATUSES,
    batchSize: Math.min(1000, Math.max(1, toInt(batchSize, 200))),
    priority: Number.isFinite(priority) ? priority : 0,
    notifyLoanOfficer,
  };
}

function outstandingOf(installment) {
  return Math.max(0, Number(installment.totalAmount) - Number(installment.paidAmount || 0));
}

function isUnpaid(installment) {
  return !CLOSED_INSTALLMENT_STATUSES.has(installment.status) && outstandingOf(installment) >= 0.01;
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Pure classification of a loan into a reminder tier for the given local date.
 * @returns {{tier:string, dpd?:number, overdueInstallments?:Array, nextInstallment?:object, daysToDue?:number}}
 */
function classifyLoan(schedules, todayKey, cfg) {
  const unpaid = (schedules || [])
    .filter(isUnpaid)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  const overdueInstallments = unpaid.filter((s) => businessHours.daysBetween(String(s.dueDate), todayKey) > 0);
  const nextInstallment = unpaid.find((s) => businessHours.daysBetween(todayKey, String(s.dueDate)) >= 0) || null;

  if (overdueInstallments.length) {
    const dpd = businessHours.daysBetween(String(overdueInstallments[0].dueDate), todayKey);
    const base = { dpd, overdueInstallments, nextInstallment };
    if (dpd >= cfg.overdue.minDpd && dpd <= cfg.overdue.maxDpd) return { tier: Tier.OVERDUE, ...base };
    if (dpd >= cfg.defaulted.minDpd && dpd <= cfg.defaulted.maxDpd) return { tier: Tier.DEFAULTED, ...base };
    return { tier: Tier.SILENT, ...base };
  }

  if (nextInstallment) {
    return {
      tier: Tier.UPCOMING,
      nextInstallment,
      daysToDue: businessHours.daysBetween(todayKey, String(nextInstallment.dueDate)),
    };
  }

  return { tier: Tier.NONE };
}

/** For an upcoming installment, returns the offset bucket that should fire today, or null. */
function pickUpcomingOffset(daysToDue, offsets) {
  if (daysToDue === 0) return offsets.includes(0) ? 0 : null;
  return offsets.find((o) => o > 0 && daysToDue <= o) ?? null;
}

function buildContext(loan, client, classification, penaltyCfg) {
  const overdueInstallments = classification.overdueInstallments || [];
  const next = classification.nextInstallment;
  const penaltyRate = Number(loan.loanProduct?.penaltyRate || 0);
  const penaltiesActive = penaltyCfg.penaltyEnabled && penaltyRate > 0;

  return {
    clientName: client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : '',
    referenceCode: loan.referenceCode,
    currency: loan.currency || '',
    daysOverdue: classification.dpd ?? 0,
    overdueCount: overdueInstallments.length,
    overdueAmount: formatAmount(overdueInstallments.reduce((sum, s) => sum + outstandingOf(s), 0)),
    oldestDueDate: overdueInstallments[0] ? String(overdueInstallments[0].dueDate) : '',
    dueDate: next ? String(next.dueDate) : '',
    dueAmount: next ? formatAmount(outstandingOf(next)) : '',
    daysToDue: classification.daysToDue ?? '',
    accruedPenalties: formatAmount(loan.penalties),
    penaltyRate: penaltyRate ? String(penaltyRate) : '0',
    penaltyNote: penaltiesActive
      ? `A late penalty of ${penaltyRate}% applies to overdue amounts${penaltyCfg.graceDays ? ` after ${penaltyCfg.graceDays} day(s)` : ''}.`
      : '',
  };
}

async function lastReminderDateKey(loanId, eventKey, timezone) {
  const last = await NotificationOutbox.findOne({
    where: { relatedLoanId: loanId, eventKey },
    order: [['created_at', 'DESC']],
    attributes: ['id', 'createdAt'],
  });
  return last ? businessHours.localDateKey(last.createdAt, timezone) : null;
}

/** Staff-created loans → creator; client (portal) loans → approver. */
async function resolveLoanOfficerId(loan) {
  if (loan.source !== 'portal' && loan.createdBy) return loan.createdBy;
  if (loan.approvedBy) return loan.approvedBy;

  // Loans approved before approved_by existed: recover from the audit trail and backfill.
  const approval = await AuditLog.findOne({
    where: { entity_type: 'LOAN', entity_id: String(loan.id), action: 'APPROVE', actor_type: 'USER' },
    order: [['occurred_at', 'DESC']],
    attributes: ['actor_id'],
  });
  const approverId = approval?.actor_id ? Number(approval.actor_id) : null;
  if (approverId) await loan.update({ approvedBy: approverId }, { hooks: false });
  return approverId;
}

async function isUserActive(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'status'] });
  return !!user && user.status === UserStatus.ACTIVE;
}

async function processLoan(loan, ctx, summary) {
  const { cfg, todayKey, timezone, penaltyCfg } = ctx;
  const classification = classifyLoan(loan.repaymentSchedules, todayKey, cfg);
  const clientRecipients = buildRecipients({ client: loan.client });

  let eventKey = null;
  let channels = null;
  let dedupeKey = null;

  switch (classification.tier) {
    case Tier.UPCOMING: {
      if (!cfg.upcoming.enabled) return;
      const offset = pickUpcomingOffset(classification.daysToDue, cfg.upcoming.offsets);
      if (offset === null) return;
      const scheduleId = classification.nextInstallment.id;
      eventKey = offset === 0 ? NotificationEventType.REPAYMENT_DUE_TODAY : NotificationEventType.REPAYMENT_DUE_SOON;
      dedupeKey = `${eventKey}:${scheduleId}:${offset}`;
      channels = cfg.upcoming.channels;
      break;
    }
    case Tier.OVERDUE:
    case Tier.DEFAULTED: {
      const tierCfg = classification.tier === Tier.OVERDUE ? cfg.overdue : cfg.defaulted;
      if (!tierCfg.enabled) return;
      eventKey = classification.tier === Tier.OVERDUE
        ? NotificationEventType.REPAYMENT_OVERDUE
        : NotificationEventType.REPAYMENT_DEFAULT_WARNING;
      const lastKey = await lastReminderDateKey(loan.id, eventKey, timezone);
      if (lastKey && businessHours.daysBetween(lastKey, todayKey) < tierCfg.intervalDays) return;
      dedupeKey = `${eventKey}:${loan.id}:${todayKey}`;
      channels = tierCfg.channels;
      break;
    }
    case Tier.SILENT:
      summary.silent++;
      return;
    default:
      return;
  }

  let officerId = cfg.notifyLoanOfficer ? await resolveLoanOfficerId(loan) : null;
  if (officerId && !(await isUserActive(officerId))) {
    summary.inactiveOfficer++;
    officerId = null;
  }
  const shared = {
    context: buildContext(loan, loan.client, classification, penaltyCfg),
    relatedLoanId: loan.id,
    dedupeKey,
    priority: cfg.priority,
    businessHoursOnly: true,
  };
  const clientChannels = channels.filter((c) => c !== NotificationChannel.IN_APP);
  let queued = 0;

  if (clientRecipients.length && clientChannels.length) {
    const result = await safeNotify(eventKey, { ...shared, recipients: clientRecipients, channels: clientChannels });
    queued += result?.rows?.length || 0;
  } else if (!clientRecipients.length) {
    summary.noContact++;
  }

  if (officerId) {
    const result = await safeNotify(eventKey, {
      ...shared,
      recipients: [{ userId: officerId }],
      channels: [NotificationChannel.IN_APP],
    });
    const officerQueued = result?.rows?.length || 0;
    if (officerQueued) summary.officerNotified++;
    queued += officerQueued;
  }

  if (queued) summary[classification.tier]++;
}

/**
 * Runs one reminder pass. No-ops outside business hours or when disabled.
 * @param {Date} [now]
 */
async function runReminders(now = new Date()) {
  const cfg = await getReminderConfig();
  if (!cfg.enabled) return { processed: 0, reason: 'disabled' };

  const hours = await businessHours.getBusinessHoursConfig();
  if (!businessHours.isWithinBusinessHours(now, hours)) return { processed: 0, reason: 'outside_business_hours' };

  const ctx = {
    cfg,
    timezone: hours.timezone,
    todayKey: businessHours.localDateKey(now, hours.timezone),
    penaltyCfg: await penaltyService.getPenaltyConfig(),
  };

  const summary = { checked: 0, upcoming: 0, overdue: 0, defaulted: 0, silent: 0, noContact: 0, inactiveOfficer: 0, officerNotified: 0, errors: 0 };
  let lastId = 0;

  for (;;) {
    const loans = await Loan.findAll({
      where: { status: { [Op.in]: cfg.eligibleStatuses }, id: { [Op.gt]: lastId } },
      include: [
        { association: 'repaymentSchedules', required: false, separate: true },
        { association: 'client', required: false, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        { association: 'loanProduct', required: false, attributes: ['id', 'penaltyRate'] },
      ],
      order: [['id', 'ASC']],
      limit: cfg.batchSize,
    });
    if (!loans.length) break;

    for (const loan of loans) {
      summary.checked++;
      try {
        await processLoan(loan, ctx, summary);
      } catch (err) {
        summary.errors++;
        logger.error(`[RepaymentReminders] Loan ${loan.id}: ${err.message}`);
      }
    }

    lastId = loans[loans.length - 1].id;
    if (loans.length < cfg.batchSize) break;
  }

  const processed = summary.upcoming + summary.overdue + summary.defaulted;
  logger.info(`[RepaymentReminders] ${JSON.stringify({ processed, ...summary })}`);
  return { processed, ...summary };
}

module.exports = { runReminders, classifyLoan, pickUpcomingOffset, getReminderConfig, Tier };

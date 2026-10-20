/**
 * repaymentReminderCronJob — hourly tick; repaymentReminderService itself no-ops outside the
 * configured business hours, so business-hours config changes apply without a restart.
 */
const cronRegistry = require('./cronRegistry');
const repaymentReminderService = require('../services/notification/repaymentReminderService');

function register() {
  if (cronRegistry.has('repayment-reminders')) return;
  cronRegistry.register({
    key: 'repayment-reminders',
    name: 'Repayment Reminders',
    description:
      'Sends client reminders for upcoming due dates, overdue (DPD 1–30, every 5 days) and defaulted ' +
      '(DPD 31–60, every 15 days) loans within business hours. Thresholds under notification.reminders.*.',
    schedule: '5 * * * *',
    scheduleLabel: 'Hourly at :05 (business hours only)',
    timezone: process.env.TZ || 'Africa/Nairobi',
    handler: () => repaymentReminderService.runReminders(),
    quiet: true,
  });
}

module.exports = { register };

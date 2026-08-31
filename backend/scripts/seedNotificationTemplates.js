/**
 * Seed script: inserts default NotificationTemplate rows for core lifecycle events.
 * Safe to re-run — uses findOrCreate so existing admin-edited templates are never overwritten.
 *
 * NOT run automatically on server startup — run manually (e.g. once after first deploy,
 * or after adding a new NotificationEventType):
 *   node backend/scripts/seedNotificationTemplates.js
 */

const NotificationTemplate = require('../models/notificationTemplateModel');
const NotificationEventType = require('../enums/notificationEventType');
const logger = require('../config/logger');

const defaults = [
  {
    eventKey: NotificationEventType.PAYMENT_RECEIVED,
    description: 'Sent when a payment is recorded against a loan.',
    emailSubject: 'Payment received — {{referenceCode}}',
    emailBody: '<p>Hi {{clientName}},</p><p>We received your payment of {{currency}} {{amount}} on loan {{referenceCode}}. Your new outstanding balance is {{currency}} {{outstandingBalance}}.</p>',
    smsBody: 'Payment of {{currency}} {{amount}} received on loan {{referenceCode}}. New balance: {{currency}} {{outstandingBalance}}.',
    pushTitle: 'Payment received',
    pushBody: 'Payment of {{currency}} {{amount}} received on loan {{referenceCode}}.',
    inAppTitle: 'Payment Received',
    inAppBody: 'Payment of {{currency}} {{amount}} received on loan {{referenceCode}}. New balance: {{currency}} {{outstandingBalance}}.',
  },
  {
    eventKey: NotificationEventType.REPAYMENT_OVERDUE,
    description: 'Sent when a loan has one or more overdue installments.',
    emailSubject: 'Repayment overdue — {{referenceCode}}',
    emailBody: '<p>Hi {{clientName}},</p><p>Your loan {{referenceCode}} has {{overdueCount}} overdue installment(s) totalling {{currency}} {{overdueAmount}}. Please make a payment as soon as possible.</p>',
    smsBody: 'Loan {{referenceCode}} has {{overdueCount}} overdue installment(s) totalling {{currency}} {{overdueAmount}}. Please pay as soon as possible.',
    pushTitle: 'Repayment overdue',
    pushBody: 'Loan {{referenceCode}} has {{overdueCount}} overdue installment(s).',
    inAppTitle: 'Repayment Overdue',
    inAppBody: 'Loan {{referenceCode}} has {{overdueCount}} overdue installment(s) totalling {{currency}} {{overdueAmount}}.',
  },
  {
    eventKey: NotificationEventType.LOAN_DISBURSED,
    description: 'Sent when a loan is disbursed.',
    emailSubject: 'Loan disbursed — {{referenceCode}}',
    emailBody: '<p>Hi {{clientName}},</p><p>Your loan {{referenceCode}} for {{currency}} {{principalAmount}} has been disbursed. Your first payment is due on {{nextPaymentDate}}.</p>',
    smsBody: 'Loan {{referenceCode}} for {{currency}} {{principalAmount}} has been disbursed. First payment due {{nextPaymentDate}}.',
    pushTitle: 'Loan disbursed',
    pushBody: 'Loan {{referenceCode}} for {{currency}} {{principalAmount}} disbursed.',
    inAppTitle: 'Loan Disbursed',
    inAppBody: 'Loan {{referenceCode}} for {{currency}} {{principalAmount}} has been disbursed. First payment due {{nextPaymentDate}}.',
  },
  {
    eventKey: NotificationEventType.LOAN_DEFAULTED,
    description: 'Sent when a loan is escalated to defaulted status.',
    emailSubject: 'Loan in default — {{referenceCode}}',
    emailBody: '<p>Hi {{clientName}},</p><p>Your loan {{referenceCode}} has been marked as defaulted due to missed payments. Please contact us immediately to resolve this.</p>',
    smsBody: 'Loan {{referenceCode}} has been marked as defaulted due to missed payments. Please contact us immediately.',
    pushTitle: 'Loan defaulted',
    pushBody: 'Loan {{referenceCode}} has been marked as defaulted.',
    inAppTitle: 'Loan Defaulted',
    inAppBody: 'Loan {{referenceCode}} has been marked as defaulted due to missed payments.',
  },
  {
    eventKey: NotificationEventType.LOAN_APPROVED,
    description: 'Sent when a loan application is approved.',
    emailSubject: 'Loan approved — {{referenceCode}}',
    emailBody: '<p>Hi {{clientName}},</p><p>Your loan application {{referenceCode}} for {{currency}} {{principalAmount}} has been approved on {{approvalDate}}.</p>',
    smsBody: 'Your loan application {{referenceCode}} for {{currency}} {{principalAmount}} has been approved.',
    pushTitle: 'Loan approved',
    pushBody: 'Loan {{referenceCode}} has been approved.',
    inAppTitle: 'Loan Approved',
    inAppBody: 'Loan application {{referenceCode}} for {{currency}} {{principalAmount}} has been approved on {{approvalDate}}.',
  },
  {
    eventKey: NotificationEventType.LOAN_REJECTED,
    description: 'Sent when a loan application is rejected.',
    emailSubject: 'Loan application update — {{referenceCode}}',
    emailBody: '<p>Hi {{clientName}},</p><p>Your loan application {{referenceCode}} was not approved.{{rejectionNote}}</p>',
    smsBody: 'Your loan application {{referenceCode}} was not approved.',
    pushTitle: 'Loan application update',
    pushBody: 'Loan application {{referenceCode}} was not approved.',
    inAppTitle: 'Loan Rejected',
    inAppBody: 'Loan application {{referenceCode}} was not approved.{{rejectionNote}}',
  },
  {
    eventKey: NotificationEventType.REGISTRATION_INVITE,
    description: 'Sent when an admin invites someone to register a new account.',
    emailSubject: 'You\u2019re invited to join {{appName}}',
    emailBody: '<p>Hi {{name}},</p><p>You have been invited to join {{appName}} as a {{roleName}}. Click the link below to complete your registration:</p><p><a href="{{inviteUrl}}">{{inviteUrl}}</a></p><p>This link expires in {{expiresHours}} hours.</p>',
    smsBody: 'You are invited to join {{appName}} as a {{roleName}}. Complete registration: {{inviteUrl}} (expires in {{expiresHours}}h).',
    pushTitle: 'You\u2019re invited',
    pushBody: 'Complete your {{appName}} registration.',
    inAppTitle: 'Registration Invite',
    inAppBody: '{{name}} was invited to join as a {{roleName}}.',
  },
];

async function seedNotificationTemplates() {
  for (const entry of defaults) {
    const [, created] = await NotificationTemplate.findOrCreate({
      where: { eventKey: entry.eventKey },
      defaults: entry,
    });
    if (created) logger.info(`NotificationTemplate: seeded default template for "${entry.eventKey}"`);
  }
}

module.exports = seedNotificationTemplates;

// Allow standalone execution: node backend/scripts/seedNotificationTemplates.js
if (require.main === module) {
  const loadEnv = require('../config/env');
  loadEnv({ path: require('path').join(__dirname, '../.env') });
  const sequelize = require('../config/sequalize_db');

  (async () => {
    try {
      await sequelize.authenticate();
      console.log('DB connected.');
      await seedNotificationTemplates();
      console.log('Done.');
      await sequelize.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

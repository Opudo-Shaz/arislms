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
  {
    eventKey: NotificationEventType.CLIENT_REGISTRATION_INVITE,
    description: 'Sent to a prospective client with an invite-only registration link.',
    inAppEnabled: false,
    pushEnabled: false,
    emailSubject: 'Register with {{appName}}',
    emailBody: '<p>Hello,</p><p>You have been invited to register as a client of {{appName}}. Use the link below to complete the registration form and upload your KYC documents:</p><p><a href="{{registrationUrl}}">{{registrationUrl}}</a></p><p>This link expires on {{expiresOn}}.</p>',
    smsBody: 'You are invited to register with {{appName}}: {{registrationUrl}} (expires {{expiresOn}}).',
    pushTitle: 'Registration invite',
    pushBody: 'Complete your {{appName}} registration.',
    inAppTitle: 'Registration invite',
    inAppBody: 'A client registration link was sent.',
  },
  {
    eventKey: NotificationEventType.OTP_VERIFICATION,
    description: 'Sent with a one-time verification code (e.g. login two-factor).',
    // In-app/push disabled by default so verification codes are not persisted
    // in the recipient's notification inbox — delivered out-of-band (email/SMS).
    inAppEnabled: false,
    pushEnabled: false,
    emailSubject: 'Your {{appName}} verification code',
    emailBody: '<p>Hi {{name}},</p><p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{code}}</p><p>This code expires in {{ttlMinutes}} minutes. If you did not try to sign in, please ignore this message.</p>',
    smsBody: '{{appName}} verification code: {{code}}. Expires in {{ttlMinutes}} minutes.',
    pushTitle: 'Verification code',
    pushBody: 'Your {{appName}} verification code is {{code}}.',
    inAppTitle: 'Verification Code',
    inAppBody: 'Your verification code is {{code}}. It expires in {{ttlMinutes}} minutes.',
  },
  {
    eventKey: NotificationEventType.LOAN_APPLICATION_SUBMITTED,
    description: 'Sent to loan approvers when a client submits a loan request through the self-service portal.',
    // Staff-facing: in-app + email only.
    smsEnabled: false,
    pushEnabled: false,
    emailSubject: 'New loan request awaiting approval — {{referenceCode}}',
    emailBody: '<p>A new loan request is in the approval queue.</p><p><strong>{{clientName}}</strong> requested {{currency}} {{principalAmount}} ({{productName}}).<br/>Credit score: {{riskScore}}/5 (grade {{riskGrade}}). {{reviewNote}}</p><p>Reference: {{referenceCode}}</p>',
    smsBody: 'New loan request {{referenceCode}} from {{clientName}} for {{currency}} {{principalAmount}} awaiting approval.',
    pushTitle: 'New loan request',
    pushBody: '{{clientName}} requested {{currency}} {{principalAmount}}.',
    inAppTitle: 'New Loan Request Awaiting Approval',
    inAppBody: '{{clientName}} requested {{currency}} {{principalAmount}} ({{productName}}) — ref {{referenceCode}}. Score {{riskScore}}/5 (grade {{riskGrade}}). {{reviewNote}}',
  },
  {
    eventKey: NotificationEventType.LOAN_APPLICATION_RECEIVED,
    description: 'Sent to the client to confirm their portal loan request was received.',
    inAppEnabled: false,
    pushEnabled: false,
    emailSubject: 'Loan request received — {{referenceCode}}',
    emailBody: '<p>Hi {{clientName}},</p><p>We have received your loan request {{referenceCode}} for {{currency}} {{principalAmount}}. {{statusNote}}</p>',
    smsBody: 'Loan request {{referenceCode}} for {{currency}} {{principalAmount}} received. {{statusNote}}',
    pushTitle: 'Loan request received',
    pushBody: 'Loan request {{referenceCode}} received.',
    inAppTitle: 'Loan Request Received',
    inAppBody: 'Loan request {{referenceCode}} for {{currency}} {{principalAmount}} received.',
  },
  {
    eventKey: NotificationEventType.PAYMENT_REPORT_SUBMITTED,
    description: 'Sent to payment reviewers when a client reports a manual repayment through the portal.',
    smsEnabled: false,
    pushEnabled: false,
    emailSubject: 'Payment reported — confirm {{externalRef}}',
    emailBody: '<p><strong>{{clientName}}</strong> reported a {{paymentMethod}} payment of {{currency}} {{amount}} (ref {{externalRef}}) on loan {{referenceCode}}.</p><p>Please confirm it against the statement and apply it.</p>',
    smsBody: '{{clientName}} reported a payment of {{currency}} {{amount}} (ref {{externalRef}}) on loan {{referenceCode}}.',
    pushTitle: 'Payment reported',
    pushBody: '{{clientName}} reported {{currency}} {{amount}}.',
    inAppTitle: 'Payment Reported — Awaiting Confirmation',
    inAppBody: '{{clientName}} reported {{currency}} {{amount}} (ref {{externalRef}}) on loan {{referenceCode}}. Confirm and apply.',
  },
  {
    eventKey: NotificationEventType.PAYMENT_REPORT_REJECTED,
    description: 'Sent to the client when staff reject a payment they reported.',
    inAppEnabled: false,
    pushEnabled: false,
    emailSubject: 'Reported payment could not be confirmed — {{externalRef}}',
    emailBody: '<p>Hi {{clientName}},</p><p>We could not confirm the payment of {{currency}} {{amount}} (ref {{externalRef}}) you reported.{{reasonNote}}</p><p>Please contact support if you believe this is a mistake.</p>',
    smsBody: 'We could not confirm your reported payment of {{currency}} {{amount}} (ref {{externalRef}}).{{reasonNote}} Contact support if this is a mistake.',
    pushTitle: 'Reported payment not confirmed',
    pushBody: 'Payment ref {{externalRef}} could not be confirmed.',
    inAppTitle: 'Reported Payment Not Confirmed',
    inAppBody: 'Payment ref {{externalRef}} could not be confirmed.{{reasonNote}}',
  },
  {
    eventKey: NotificationEventType.CO_SIGNER_CONSENT_REQUEST,
    description: 'Sent to a nominated co-signer with a link to review and consent to guarantee a loan.',
    inAppEnabled: false,
    pushEnabled: false,
    emailSubject: '{{borrowerName}} has asked you to co-sign a loan',
    emailBody: '<p>Hi {{coSignerName}},</p><p><strong>{{borrowerName}}</strong> has named you as co-signer (guarantor) for a {{productName}} of {{currency}} {{principalAmount}} over {{termMonths}} months (ref {{referenceCode}}).</p><p>As co-signer you may be responsible for repayments if the borrower does not pay. Please review and accept or decline here:</p><p><a href="{{consentUrl}}">{{consentUrl}}</a></p><p>This link expires in {{expiresHours}} hours. If you do not know this person, decline the request.</p>',
    smsBody: '{{borrowerName}} named you co-signer for a {{currency}} {{principalAmount}} loan ({{referenceCode}}). Review & respond: {{consentUrl}} (expires in {{expiresHours}}h)',
    pushTitle: 'Co-signer request',
    pushBody: '{{borrowerName}} asked you to co-sign a loan.',
    inAppTitle: 'Co-signer Request',
    inAppBody: '{{borrowerName}} asked you to co-sign loan {{referenceCode}}.',
  },
  {
    eventKey: NotificationEventType.CO_SIGNER_CONSENT_RESPONDED,
    description: 'Sent to the borrower (SMS/email) and approvers (in-app) when a co-signer accepts or declines.',
    pushEnabled: false,
    emailSubject: 'Co-signer update — {{referenceCode}}',
    emailBody: '<p>Hi {{borrowerName}},</p><p>{{coSignerName}} has {{decisionText}} your loan {{referenceCode}}.{{reasonNote}}</p><p>{{nextStep}}</p>',
    smsBody: '{{coSignerName}} has {{decisionText}} loan {{referenceCode}}.{{reasonNote}} {{nextStep}}',
    pushTitle: 'Co-signer update',
    pushBody: '{{coSignerName}} has {{decisionText}} loan {{referenceCode}}.',
    inAppTitle: 'Co-signer Responded',
    inAppBody: '{{coSignerName}} has {{decisionText}} loan {{referenceCode}}.{{reasonNote}}',
  },
  {
    eventKey: NotificationEventType.CLIENT_WELCOME,
    description: 'Sent to a client the first time their KYC is verified and their account becomes active.',
    smsEnabled: false,
    inAppEnabled: false,
    pushEnabled: false,
    emailSubject: 'Welcome to {{appName}} — your account is active',
    emailBody: [
      '<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#23282c;">Welcome to {{appName}}, {{clientName}}!</h2>',
      '<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#23282c;">Your identity has been verified and your client account is now active.</p>',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>',
      '<td style="background-color:#f8f9fa;border-left:4px solid #5dcae2;border-radius:0 4px 4px 0;padding:14px 16px;">',
      '<p style="margin:0 0 4px;font-size:13px;color:#636f83;">Your account number</p>',
      '<p style="margin:0;font-size:20px;font-weight:700;letter-spacing:1px;color:#23282c;">{{accountNumber}}</p>',
      '</td></tr></table>',
      '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#23282c;">You can now sign in to the client portal with your registered phone number to apply for loans, track repayments and manage your profile.</p>',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center">',
      '<a href="{{portalLoginUrl}}" style="display:inline-block;background-color:#5dcae2;color:#080a0c;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:6px;">Sign in to the Portal</a>',
      '</td></tr></table>',
      '<p style="margin:0 0 8px;font-size:12px;color:#8a93a2;">If the button above doesn&rsquo;t work, copy and paste this link into your browser:</p>',
      '<p style="margin:0;font-size:12px;word-break:break-all;font-family:monospace,monospace;"><a href="{{portalLoginUrl}}" style="color:#2b3041;">{{portalLoginUrl}}</a></p>',
    ].join(''),
    smsBody: 'Welcome to {{appName}}, {{clientName}}! Your account {{accountNumber}} is now active. Sign in: {{portalLoginUrl}}',
    pushTitle: 'Welcome to {{appName}}',
    pushBody: 'Your account {{accountNumber}} is now active.',
    inAppTitle: 'Welcome',
    inAppBody: 'Your account {{accountNumber}} is now active.',
  },
  {
    eventKey: NotificationEventType.CLIENT_KYC_REVERIFICATION_REQUESTED,
    description: 'Sent to a client (SMS + email) when staff ask them to sign in to the portal and update their KYC information.',
    inAppEnabled: false,
    pushEnabled: false,
    emailSubject: 'Action required: update your information on {{appName}}',
    emailBody: [
      '<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#23282c;">Hi {{clientName}}, we need a bit more information</h2>',
      '<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#23282c;">To finish verifying your identity, please sign in to the client portal and update your information as requested.</p>',
      '{{kycNotesBlock}}',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center">',
      '<a href="{{portalLoginUrl}}" style="display:inline-block;background-color:#5dcae2;color:#080a0c;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:6px;">Sign in and update my information</a>',
      '</td></tr></table>',
      '<p style="margin:0 0 8px;font-size:12px;color:#8a93a2;">If the button above doesn&rsquo;t work, copy and paste this link into your browser:</p>',
      '<p style="margin:0;font-size:12px;word-break:break-all;font-family:monospace,monospace;"><a href="{{portalLoginUrl}}" style="color:#2b3041;">{{portalLoginUrl}}</a></p>',
    ].join(''),
    smsBody: '{{appName}}: Hi {{clientName}}, please log in and update your information as requested: {{portalLoginUrl}}',
    pushTitle: 'Update your information',
    pushBody: 'Please sign in and update your information as requested.',
    inAppTitle: 'KYC Update Required',
    inAppBody: 'Please sign in and update your information as requested.',
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

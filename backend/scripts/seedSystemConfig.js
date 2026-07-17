/**
 * Seed script: inserts default system configuration entries.
 * Safe to re-run — uses findOrCreate so existing UI-managed values are never overwritten.
 *
 * Add entries here for configs that:
 *   - have sensible defaults on first install, AND
 *   - can be changed by admins via the System Config UI after that.
 *
 * Env-driven, read-only infra configs (storage.*, email.provider.gmail.user/pass)
 * are seeded automatically on server startup via systemConfigService.seedInfraConfigs().
 *
 * Usage:
 *   node backend/scripts/seedSystemConfig.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');
const SystemConfig = require('../models/systemConfigModel');

const defaults = [
  // ── Loans ──────────────────────────────────────────────────────────────
  {
    key: 'payment.min_overpayment_surplus',
    label: 'Minimum Overpayment Surplus',
    value: '1',
    category: 'loans',
    description:
      'Overpayment amounts below this threshold (in the loan currency) are treated as ' +
      'immaterial rounding noise. They are absorbed into the payment instead of being ' +
      'posted as a separate member-contribution record and journal line.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'loan.deletion_of_active_loan_enabled',
    label: 'Allow Deleting Active (Disbursed) Loans',
    value: null,
    category: 'loans',
    description:
      'When enabled, disbursed/active loans may be deleted (their outstanding principal is ' +
      'written off). When disabled, only pre-disbursement loans can be deleted.',
    isBoolean: true,
    isActive: false, // isActive IS the value for boolean configs — disabled by default
    isReadOnly: false,
  },
  // ── Email ───────────────────────────────────────────────────────────────
  {
    key: 'email.provider',
    label: 'Email Provider',
    value: 'gmail',
    category: 'email',
    description: 'Active email sending provider. Supported: gmail',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'email.from_name',
    label: 'Email From Name',
    value: 'ARISLMS',
    category: 'email',
    description: 'Display name shown in the From field of outgoing emails',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'email.from_address',
    label: 'Email From Address',
    value: '',
    category: 'email',
    description: 'Sender email address for outgoing emails (leave blank to use the Gmail SMTP username)',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'email.provider.gmail.host',
    label: 'Gmail SMTP Host',
    value: 'smtp.gmail.com',
    category: 'email',
    description: 'SMTP host for the Gmail provider',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'email.provider.gmail.port',
    label: 'Gmail SMTP Port',
    value: '587',
    category: 'email',
    description: 'SMTP port. 587 = STARTTLS (recommended), 465 = TLS on connect',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'email.provider.gmail.secure',
    label: 'Gmail SMTP Secure (TLS on connect)',
    value: 'false',
    category: 'email',
    description: 'Set to true only when using port 465. Leave false for port 587 (STARTTLS).',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
];

async function seed() {
  await sequelize.authenticate();
  console.log('DB connected.');

  for (const entry of defaults) {
    const [, created] = await SystemConfig.findOrCreate({
      where: { key: entry.key },
      defaults: entry,
    });
    console.log(`  ${entry.key}: ${created ? 'inserted' : 'already exists (skipped)'}`);
  }

  console.log('Done.');
  await sequelize.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

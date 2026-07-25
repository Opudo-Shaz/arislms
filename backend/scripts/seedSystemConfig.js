/**
 * Seed script: inserts default system configuration entries.
 * Safe to re-run — uses findOrCreate so existing UI-managed values are never overwritten.
 *
 * Add entries here for configs that:
 *   - have sensible defaults on first install, AND
 *   - can be changed by admins via the System Config UI after that.
 *
 * Env-driven, read-only infra configs (email.provider.gmail.user/pass)
 * are seeded automatically on server startup via systemConfigService.seedInfraConfigs().
 * Everything else, including storage.* (local/S3 settings), is UI-editable and lives here.
 *
 * Usage:
 *   node backend/scripts/seedSystemConfig.js
 */

const loadEnv = require('../config/env');
loadEnv({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');
const SystemConfig = require('../models/systemConfigModel');

const defaults = [
  // ── Storage ────────────────────────────────────────────────────────────
  {
    key: 'storage.provider',
    label: 'Storage Provider',
    value: 'local',
    category: 'storage',
    description: 'Document storage backend: local | s3 | minio. Must match the DOCUMENT_STORAGE_PROVIDER env var for the change to take effect.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'storage.local.path',
    label: 'Local Storage Path',
    value: 'uploads/documents',
    category: 'storage',
    description: 'Filesystem path (relative to project root) used when storage.provider = local.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'storage.local.base_url',
    label: 'Storage Base URL',
    value: '',
    category: 'storage',
    description: 'Base URL of this API server, used to build local document links.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'storage.s3.endpoint',
    label: 'S3 Endpoint',
    value: '',
    category: 'storage',
    description: 'Custom endpoint for S3-compatible storage (e.g. Cloudflare R2, MinIO). Leave blank for real AWS S3.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'storage.s3.region',
    label: 'S3 Region',
    value: 'auto',
    category: 'storage',
    description: 'Bucket region. R2/MinIO ignore this (use "auto"); AWS S3 requires a real region.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'storage.s3.bucket',
    label: 'S3 Bucket',
    value: '',
    category: 'storage',
    description: 'Bucket name used when storage.provider = s3 or minio.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'storage.s3.access_key_id',
    label: 'S3 Access Key ID',
    value: '',
    category: 'storage',
    description: 'Access key for the S3-compatible storage account (e.g. Cloudflare R2 API token key ID).',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
    isSecret: true,
  },
  {
    key: 'storage.s3.secret_access_key',
    label: 'S3 Secret Access Key',
    value: '',
    category: 'storage',
    description: 'Secret key for the S3-compatible storage account.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
    isSecret: true,
  },
  {
    key: 'storage.s3.force_path_style',
    label: 'S3 Force Path-Style URLs',
    value: 'true',
    category: 'storage',
    description: 'Required by R2/MinIO. Set to false for AWS S3 virtual-hosted-style URLs.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'storage.s3.signed_url_expiry_seconds',
    label: 'S3 Signed URL Expiry (seconds)',
    value: '300',
    category: 'storage',
    description: 'How long generated document download links remain valid before expiring.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
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
    description: 'Active email sending provider. Supported: gmail, gmail-api',
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
    description: 'Sender email address for outgoing emails (leave blank to use the provider username)',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  // ── Email — Gmail API (OAuth2) ─────────────────────────────────────────
  {
    key: 'email.provider.gmail-api.user',
    label: 'Gmail API — Sender Address',
    value: '',
    category: 'email',
    description: 'Gmail address that will send messages via the Gmail API (must match the account that authorised the OAuth2 credentials)',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'email.provider.gmail-api.client_id',
    label: 'Gmail API — OAuth2 Client ID',
    value: '',
    category: 'email',
    description: 'OAuth2 Client ID from Google Cloud Console (APIs & Services → Credentials)',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'email.provider.gmail-api.client_secret',
    label: 'Gmail API — OAuth2 Client Secret',
    value: '',
    category: 'email',
    description: 'OAuth2 Client Secret from Google Cloud Console',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
    isSecret: true,
  },
  {
    key: 'email.provider.gmail-api.refresh_token',
    label: 'Gmail API — OAuth2 Refresh Token',
    value: '',
    category: 'email',
    description: 'Long-lived refresh token obtained via OAuth Playground (scope: https://mail.google.com/). Never expires unless revoked.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
    isSecret: true,
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
  {
    key: 'loans.penalty.enabled',
    label: 'Loan Penalty Enabled',
    value: 'false',
    category: 'loans',
    description: 'Enable or disable loan penalties',
    isBoolean: true,
    isActive: true,
    isReadOnly: false,
  },
  {
    key: 'loans.penalty.grace_days',
    label: 'Penalty Grace Period (days)',
    value: '0',
    category: 'loans',
    description: 'Number of days after a missed installment due date before a penalty is charged. Default: 0 (charge immediately when overdue).',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  }
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

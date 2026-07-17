/**
 * Backend enum mirrors with display labels and badge colors.
 *
 * Keep these in sync with `backend/enums/*`. Each map provides:
 * - `values`: array of raw enum values as the API expects/returns them,
 * - `labels`: human-friendly display text,
 * - `colors`: CoreUI badge color per value (primary/secondary/success/danger/
 *   warning/info/light/dark).
 *
 * @module constants/enums
 */

/** Convert a snake/upper value into a Title Case label. */
const titleize = (value) =>
  String(value)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/** Build `{ values, labels, colors }` from a value->color map. */
const buildEnum = (colorMap, labelOverrides = {}) => {
  const values = Object.keys(colorMap)
  const labels = {}
  values.forEach((v) => {
    labels[v] = labelOverrides[v] ?? titleize(v)
  })
  return { values, labels, colors: colorMap }
}

export const LOAN_STATUS = buildEnum({
  pending: 'secondary',
  pending_reverification: 'warning',
  verified: 'info',
  in_review: 'info',
  under_review: 'info',
  approved: 'primary',
  rejected: 'danger',
  disbursed: 'primary',
  active: 'success',
  partially_paid: 'warning',
  overdue: 'danger',
  defaulted: 'danger',
  closed: 'success',
  cancelled: 'secondary',
  deleted: 'dark',
  written_off: 'dark',
  partially_written_off: 'warning',
  recovered: 'success',
})

export const CLIENT_STATUS = buildEnum({
  pending: 'secondary',
  active: 'success',
  inactive: 'secondary',
  suspended: 'warning',
  blacklisted: 'danger',
  pending_kyc_reverification: 'warning',
  kyc_failed: 'danger',
})

export const KYC_STATUS = buildEnum({
  not_started: 'secondary',
  in_progress: 'info',
  verified: 'success',
  rejected: 'danger',
})

export const ACCOUNT_TYPE = buildEnum(
  {
    ASSET: 'primary',
    LIABILITY: 'warning',
    EQUITY: 'info',
    REVENUE: 'success',
    EXPENSE: 'danger',
  },
  { ASSET: 'Asset', LIABILITY: 'Liability', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expense' },
)

export const COLLATERAL_TYPE = buildEnum(
  {
    car_log_book: 'info',
    title_deed: 'primary',
    other: 'secondary',
  },
  { car_log_book: 'Car Log Book', title_deed: 'Title Deed', other: 'Other' },
)

export const COLLATERAL_STATUS = buildEnum({
  pledged: 'secondary',
  verified: 'info',
  active: 'success',
  released: 'primary',
  liquidated: 'danger',
})

export const CONTRIBUTION_TYPE = buildEnum(
  {
    CONTRIBUTION: 'success',
    WITHDRAWAL: 'warning',
    OVERPAYMENT_CREDIT: 'info',
  },
  {
    CONTRIBUTION: 'Contribution',
    WITHDRAWAL: 'Withdrawal',
    OVERPAYMENT_CREDIT: 'Overpayment Credit',
  },
)

export const INTEREST_TYPE = buildEnum({
  fixed: 'primary',
  variable: 'info',
  simple: 'secondary',
  compound: 'secondary',
  flat: 'secondary',
  reducing: 'secondary',
})

/** Reasons required when deleting a loan (must match backend enums/loanDeletionReason.js). */
export const LOAN_DELETION_REASONS = [
  { value: 'data_entry_error', label: 'Data entry error' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'client_request', label: 'Client request' },
  { value: 'unrecoverable', label: 'Unrecoverable (write-off)' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'other', label: 'Other' },
]

/** How a loan product's minimum down payment is interpreted. */
export const DOWN_PAYMENT_TYPE = buildEnum(
  { amount: 'secondary', percentage: 'info' },
  { amount: 'Fixed amount', percentage: 'Percentage' },
)

export const JOURNAL_ENTRY_STATUS = buildEnum(
  {
    DRAFT: 'secondary',
    POSTED: 'success',
    REVERSED: 'danger',
  },
  { DRAFT: 'Draft', POSTED: 'Posted', REVERSED: 'Reversed' },
)

/** Source/origin of a journal entry (used as a ledger filter). */
export const LEDGER_SOURCE_TYPE = buildEnum(
  {
    LOAN_DISBURSEMENT: 'primary',
    PAYMENT: 'success',
    CONTRIBUTION: 'info',
    MANUAL: 'secondary',
    FEE: 'warning',
    EXPENSE: 'danger',
    REVERSAL: 'dark',
  },
  {
    LOAN_DISBURSEMENT: 'Loan Disbursement',
    PAYMENT: 'Payment',
    CONTRIBUTION: 'Contribution',
    MANUAL: 'Manual',
    FEE: 'Fee',
    EXPENSE: 'Expense',
    REVERSAL: 'Reversal',
  },
)

/** Source types a user may select when posting a manual journal entry. */
export const MANUAL_SOURCE_TYPES = ['MANUAL', 'EXPENSE']

/** Normal balance side of a ledger account. */
export const NORMAL_BALANCE = buildEnum(
  { DEBIT: 'primary', CREDIT: 'info' },
  { DEBIT: 'Debit', CREDIT: 'Credit' },
)

export const LOAN_TRANSACTION_TYPE = buildEnum({
  disbursement: 'primary',
  downpayment: 'info',
  repayment: 'success',
  transfer: 'info',
  principal_update: 'warning',
  fee: 'secondary',
  penalty: 'danger',
  reversal: 'danger',
  write_off: 'dark',
  adjustment: 'secondary',
})

export const TRANSACTION_DIRECTION = buildEnum(
  { DEBIT: 'warning', CREDIT: 'success' },
  { DEBIT: 'Debit', CREDIT: 'Credit' },
)

export const DOCUMENT_CATEGORY = buildEnum(
  {
    user_kyc: 'primary',
    client_kyc: 'info',
    loan_collateral: 'warning',
    loan_supporting: 'secondary',
    member_contribution: 'primary',
    other: 'secondary',
  },
  {
    user_kyc: 'User KYC',
    client_kyc: 'Client KYC',
    loan_collateral: 'Loan Collateral',
    loan_supporting: 'Loan Supporting',
    member_contribution: 'Member Contribution',
    other: 'Other',
  },
)

export const DOCUMENT_TYPE = buildEnum(
  {
    user_photo: 'primary',
    client_photo: 'info',
    national_id: 'primary',
    passport: 'primary',
    driving_license: 'primary',
    birth_certificate: 'secondary',
    utility_bill: 'warning',
    bank_statement: 'warning',
    payslip: 'warning',
    tax_certificate: 'secondary',
    title_deed: 'success',
    vehicle_logbook: 'success',
    insurance_certificate: 'info',
    valuation_report: 'info',
    guarantor_id: 'warning',
    business_permit: 'secondary',
    other: 'secondary',
  },
  {
    user_photo: 'User Photo',
    client_photo: 'Client Photo',
    national_id: 'National ID',
    passport: 'Passport',
    driving_license: 'Driving License',
    birth_certificate: 'Birth Certificate',
    utility_bill: 'Utility Bill',
    bank_statement: 'Bank Statement',
    payslip: 'Payslip',
    tax_certificate: 'Tax Certificate',
    title_deed: 'Title Deed',
    vehicle_logbook: 'Vehicle Logbook',
    insurance_certificate: 'Insurance Certificate',
    valuation_report: 'Valuation Report',
    guarantor_id: 'Guarantor ID',
    business_permit: 'Business Permit',
    other: 'Other',
  },
)

/** Document type valid for user profile photos. */
export const USER_PHOTO_DOCUMENT_TYPE = 'user_photo'
export const USER_KYC_CATEGORY = 'user_kyc'

/** Document types valid for the Client KYC category. */
export const CLIENT_KYC_DOCUMENT_TYPES = [
  'client_photo',
  'national_id',
  'passport',
  'driving_license',
  'birth_certificate',
  'other',
]

/** Document types valid for loan supporting / collateral documents. */
export const LOAN_DOCUMENT_TYPES = [
  'title_deed',
  'vehicle_logbook',
  'insurance_certificate',
  'valuation_report',
  'bank_statement',
  'payslip',
  'tax_certificate',
  'business_permit',
  'guarantor_id',
  'other',
]

export const DOCUMENT_STATUS = buildEnum({
  active: 'success',
  archived: 'secondary',
  deleted: 'danger',
})

/** Repayment schedule installment status: pending, paid, overdue, partial. */
export const REPAYMENT_SCHEDULE_STATUS = buildEnum({
  pending: 'secondary',
  paid: 'success',
  partial: 'warning',
  overdue: 'danger',
  written_off: 'dark',
})

/** Payment record status (free-text on the backend; common values mapped). */
export const PAYMENT_STATUS = buildEnum({
  completed: 'success',
  pending: 'secondary',
  failed: 'danger',
  reversed: 'dark',
})

/**
 * Payment methods. The backend stores this as a free string (max 32 chars);
 * these are the supported options offered in the record-payment form.
 */
export const PAYMENT_METHOD = buildEnum(
  {
    MPESA: 'success',
    CASH: 'secondary',
    BANK_TRANSFER: 'info',
    CHEQUE: 'warning',
    CARD: 'primary',
    OTHER: 'secondary',
  },
  {
    MPESA: 'M-Pesa',
    CASH: 'Cash',
    BANK_TRANSFER: 'Bank Transfer',
    CHEQUE: 'Cheque',
    CARD: 'Card',
    OTHER: 'Other',
  },
)

/** Audit log action types (see backend/models/auditLogModel.js). */
export const AUDIT_ACTION = buildEnum(
  {
    CREATE: 'success',
    UPDATE: 'info',
    DELETE: 'danger',
    APPROVE: 'primary',
    DISBURSE: 'primary',
    REVERSE: 'warning',
    UPDATE_PRINCIPAL: 'warning',
    KYC_VERIFY: 'success',
    KYC_REQUEST_INFO: 'info',
    KYC_REJECT: 'danger',
    ACTIVATE: 'success',
    DEACTIVATE: 'secondary',
    SUSPEND: 'warning',
    BLACKLIST: 'danger',
    RESET_PASSWORD: 'warning',
  },
  {
    UPDATE_PRINCIPAL: 'Update Principal',
    KYC_VERIFY: 'KYC Verify',
    KYC_REQUEST_INFO: 'KYC Request Info',
    KYC_REJECT: 'KYC Reject',
    RESET_PASSWORD: 'Reset Password',
  },
)

/** Audit actor types. */
export const ACTOR_TYPE = buildEnum(
  { USER: 'primary', SERVICE: 'info', SYSTEM: 'secondary' },
  { USER: 'User', SERVICE: 'Service', SYSTEM: 'System' },
)

/** Notification types (see backend/models/notificationModel.js). */
export const NOTIFICATION_TYPE = buildEnum(
  {
    info: 'info',
    loan: 'primary',
    payment: 'success',
    warning: 'warning',
    reminder: 'secondary',
  },
  { info: 'Info', loan: 'Loan', payment: 'Payment', warning: 'Warning', reminder: 'Reminder' },
)

/** Numeric backend role ids. */
export const ROLES = {
  ADMIN: 1,
  MANAGER: 2,
  LIMITED: 3,
}/** Convenience role groups for `RequireRole`. */
export const ROLE_GROUPS = {
  /** Admin + manager (privileged write operations). */
  STAFF: [ROLES.ADMIN, ROLES.MANAGER],
  /** Any authenticated role. */
  ALL: [ROLES.ADMIN, ROLES.MANAGER, ROLES.LIMITED],
}

/** Fallback display labels for the built-in numeric role ids. */
export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.LIMITED]: 'Limited',
}

/**
 * Look up the badge color for an enum value.
 * @param {{ colors: Record<string,string> }} enumDef
 * @param {string} value
 * @returns {string} CoreUI color (defaults to `secondary`).
 */
export const badgeColor = (enumDef, value) => enumDef.colors[value] || 'secondary'

/**
 * Look up the display label for an enum value.
 * @param {{ labels: Record<string,string> }} enumDef
 * @param {string} value
 * @returns {string}
 */
export const enumLabel = (enumDef, value) => enumDef.labels[value] || value || '—'

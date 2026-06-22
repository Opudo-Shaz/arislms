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
  closed: 'dark',
  cancelled: 'secondary',
  deleted: 'dark',
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

export const JOURNAL_ENTRY_STATUS = buildEnum(
  {
    DRAFT: 'secondary',
    POSTED: 'success',
    REVERSED: 'danger',
  },
  { DRAFT: 'Draft', POSTED: 'Posted', REVERSED: 'Reversed' },
)

export const LOAN_TRANSACTION_TYPE = buildEnum({
  disbursement: 'primary',
  repayment: 'success',
  transfer: 'info',
  principal_update: 'warning',
  fee: 'secondary',
  penalty: 'danger',
  reversal: 'danger',
  write_off: 'dark',
  adjustment: 'secondary',
})

export const DOCUMENT_CATEGORY = buildEnum(
  {
    client_kyc: 'info',
    loan_collateral: 'warning',
    loan_supporting: 'secondary',
    member_contribution: 'primary',
    other: 'secondary',
  },
  {
    client_kyc: 'Client KYC',
    loan_collateral: 'Loan Collateral',
    loan_supporting: 'Loan Supporting',
    member_contribution: 'Member Contribution',
    other: 'Other',
  },
)

export const DOCUMENT_TYPE = buildEnum(
  {
    client_photo: 'info',
    national_id: 'primary',
    passport: 'primary',
    driving_license: 'primary',
    voters_card: 'secondary',
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
    client_photo: 'Client Photo',
    national_id: 'National ID',
    passport: 'Passport',
    driving_license: 'Driving License',
    voters_card: "Voter's Card",
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

export const DOCUMENT_STATUS = buildEnum({
  active: 'success',
  archived: 'secondary',
  deleted: 'danger',
})

/** Numeric backend role ids. */
export const ROLES = {
  ADMIN: 1,
  MANAGER: 2,
  LIMITED: 3,
}

/** Convenience role groups for `RequireRole`. */
export const ROLE_GROUPS = {
  /** Admin + manager (privileged write operations). */
  STAFF: [ROLES.ADMIN, ROLES.MANAGER],
  /** Any authenticated role. */
  ALL: [ROLES.ADMIN, ROLES.MANAGER, ROLES.LIMITED],
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

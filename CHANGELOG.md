# Changelog

All notable changes to Aris LMS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Features merged after v1.0 will be documented here as they land, then rolled
into the next dated release section below when that version ships.

### Added
### Changed
### Fixed
### Security

## [1.0.0] - 2026-08-21

Initial baseline release of Aris LMS — a full-stack loan management system for
microfinance institutions. Everything below was built prior to this tag and is
documented here as a single consolidated release; subsequent work will get
its own dated entry under `Unreleased` above.

### Added

**Client & KYC Management**
- Client CRUD with address, occupation, income, and ID document capture.
- KYC workflow: verify, request info, reject.
- Client lifecycle status transitions: activate, deactivate, suspend, blacklist.

**Loan Origination & Servicing**
- Loan products (flat/reducing interest, configurable interest rate periods —
  monthly/annually) with full CRUD.
- Loan application workflow with KYC/status gating, collateral capture, and
  co-signer support.
- Loan approval and disbursement pipeline with automatic repayment schedule
  generation.
- Principal amount updates with loan-product validation.
- Soft delete for loans with validation against conflicting open loans.
- Automated daily loan status cron job (overdue/defaulted detection, recovery,
  provisioning) with admin visibility and manual "run now" trigger.
- Fixes for loan status transitions when installments were already overdue.

**Credit Scoring**
- Credit scoring engine (age, income, debt, missed-payments factors) with
  risk evaluation integrated into loan creation.

**Payments & Collateral**
- Payment recording against loans with currency validation, overpayment
  auto-credit to member contributions, and payer/reference metadata.
- Collateral tracking per loan with admin-managed status updates.

**Member Contributions & Accounting**
- Member contribution/withdrawal tracking with running balance and statements.
- Chart of accounts (CRUD, activate/deactivate).
- General ledger with journal entries, reversal, and trial balance reporting.
- Automatic journal postings for disbursements, payments, and contributions.

**Reporting & Dashboard**
- Portfolio aging report (current / 1-30 / 31-60 / 61-90 / 90+ buckets).
- Dashboard KPIs, loan status breakdown, monthly disbursement/collection and
  income/expenditure trends, and recent activity feed.
- Audit trail report with entity/action/actor filters.

**Administration & Platform**
- Role management with configurable permissions.
- User management with status control (active/inactive/suspended) and
  admin-driven password resets.
- Configurable system settings, including dropdown-backed config values
  sourced from a reusable Codes/Code Values admin module.
- Document uploads with S3 and local storage provider support, streaming
  downloads, and filename sanitization.
- Secret system-configuration values with encryption at rest and
  reveal-on-demand.
- Email notifications (Gmail API provider) and in-app notification center.
- Node-cache-backed configuration and auth-user caching for performance.
- Full audit logging across create/update/delete/status-change actions,
  including actor and user-agent tracking.
- Swagger/OpenAPI documentation for the full API surface.

**Security**
- JWT authentication with per-user `token_version` for immediate session
  invalidation on password/status changes.
- Route-level and field-level input validation (Joi DTOs, positive-integer
  ID param validation).
- Role-based authorization across all sensitive endpoints.

**Frontend Admin Portal**
- Full React 19 + Vite + CoreUI admin portal wired to the backend API
  (TanStack Query + Axios), covering clients, loan products, loans, loan
  approvals, payments, collaterals, chart of accounts, ledger, trial
  balance, member contributions, users, roles, notifications, codes/system
  config, cron job visibility, audit trail, portfolio aging, and dashboard.
- User profile module with editable details, photo upload, and locally
  persisted display settings.
- Modernized data table and status badge styling (sortable columns, sticky
  headers, theme/dark-mode-aware badges) applied across list views.
- Refactored 404 and layout pages for a more polished look and feel.

### Fixed
- Checkbox styling inconsistencies.
- Payment amount and outstanding balance calculation edge cases.
- SummaryView text readability in dark mode.

### Security
- Auth user cache invalidation and token-version bump on every
  password/status change, closing the window where a revoked user could
  keep acting on a stale JWT.

[Unreleased]: https://github.com/Opudo-Shaz/arislms/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Opudo-Shaz/arislms/releases/tag/v1.0.0

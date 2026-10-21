# Changelog

All notable changes to Aris LMS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Features merged after v1.2.0 will be documented here as they land, then rolled
into the next dated release section below when that version ships.

### Added

- **Health endpoints** — public `GET /api/health` (liveness, no DB access) and
  `GET /api/health/ready` (readiness; 503 when the database is unreachable, with
  the DB check cached for 5 seconds). Responses carry `timestamp` in the server
  timezone (`TZ`, default `Africa/Nairobi`) with its UTC offset, plus `timezone`
  and `utcOffset`. Neither is rate limited, and probes are not
  written to the HTTP request log.
- **Ping Africa SMS delivery receipts** — SMS sends (single and bulk) are now
  tracked in `sms_messages`, and Ping Africa's `sms.sent` / `sms.delivered` /
  `sms.failed` webhooks update them via the public, HMAC-signed
  `POST /api/webhooks/sms/ping-africa`. A carrier failure on an outbox-backed SMS
  is reflected on its `notification_outbox` row (no automatic re-send). Admins
  register the webhook with `POST /api/sms-providers/ping-africa/webhook`
  (needs `API_PUBLIC_URL` or a `url` in the body), which stores the signing secret
  in the new `sms.provider.ping-africa.webhook_secret` config; the same path also
  supports `GET` (list) and `GET`/`PUT`/`DELETE` on `/:id` to inspect, update or
  remove endpoints (deleting the active one clears the stored secret). Existing
  installs   must run the **System Config Defaults** seeder. The webhook rejects bodies over
  16 KB and answers 429 to an IP after 20 bad signatures in 15 minutes (valid
  traffic is never throttled).
- **Client welcome email** — the first time a client's KYC is verified (and the
  account becomes active), the client is emailed their account number and a
  portal sign-in button with a copy-paste fallback link
  (`{FRONTEND_URL}/portal/login`). Re-verifications don't resend it. Uses the new
  `client_welcome` notification template (email only by default; SMS, push and
  in-app can be enabled from the template). Existing installs must run the
  **Notification Templates** seeder to add it.
- **KYC re-verification notice** — when staff request more KYC information from a
  client (including flagging a document for re-upload), the client now gets an SMS
  and an email asking them to log in and update their information, with the portal
  login link (`{FRONTEND_URL}/portal/login`). This covers newly registered clients
  who haven't been verified yet and so never received the welcome email. Uses the
  new `client_kyc_reverification_requested` template; existing installs must run
  the **Notification Templates** seeder.

### Changed

- **System config categories come from the backend** — `GET /api/system-configs`
  now returns a `categories` array (from `SYSTEM_CONFIG_CATEGORIES`), and the
  admin UI uses it for the category filter, form dropdown and badges. The
  frontend `VITE_SYSTEM_CONFIG_CATEGORIES` variable is no longer used and can be
  removed.

## [1.2.0] - 2026-10-16

Third release of Aris LMS, adding the client self-service portal and
invite-only client registration on top of the v1.1 baseline.

### Added

**Invite-only Client Registration Links**
- Staff generate a registration link (`Clients > Registration Links`), valid for
  10 days (`client.registration.link_ttl_days`), optionally sending it to a list
  of emails and/or phone numbers. Recipients are used once to queue the
  messages and are not stored; the link can be copied again later or revoked.
- One link registers many clients; each link shows how many clients used it and
  who they are.
- Public multi-step form (`/register/client`) collects the profile and KYC
  documents in a single submit, caching typed values so errors or reloads do
  not lose input. Clients are created `pending` with KYC `in_progress` and
  appear in the existing KYC queue.
- Documents are added by type (client photo, national ID, passport, driving
  license, birth certificate, other) into a preview list, as on the client
  details KYC card. A client photo and the document matching the chosen ID
  type are required.
- Uploads are validated against their bytes (JPG/PNG/WebP/PDF only, 5 MB,
  extension/MIME/content must agree, hidden trailing data and PDF scripts or
  embedded files rejected). This is structural validation, not antivirus.
- New system config `client.registration.enable_otp` (category `clients`): when
  on, the phone must be verified with a one-time code, sent by SMS only so the
  number itself is confirmed, for both self-registration and staff-created
  clients. New permissions `client_registration_links:read|create|update`.
- Email is optional when registering a client (self or staff); clients without
  one simply receive SMS/in-app notifications.
- Public endpoints are rate limited per IP, phone and link; set `TRUST_PROXY`
  when running behind a reverse proxy so per-IP limits see the real client IP.
- Clients is now a sidebar submenu (All Clients, Registration Links), and
  required-field asterisks are shown in red across the app.

**Client Self-Service Portal**
- Public home page (`/`) with loan products and separate client / staff
  sign-in entry points.
- Passwordless client sign-in (phone number + one-time code by SMS, or by
  email when a valid address is on file) with its own session, layout and
  `/api/portal` API, fully isolated from staff sessions.
- Client navigation: Dashboard, My Loans (with schedule and payments),
  Apply for a Loan, My Payments, Report a Payment, My Profile (self-editable
  contact details).
- Client loan requests run the standard credit-scoring pipeline and are
  always queued for approval; users holding `loans:approve` are notified
  (in-app + email), with sub-threshold scores flagged for manual review and
  the client advised to contact support.
- Client-reported payments (temporary until M-Pesa integration): clients
  report manual repayments against their current loan; users holding the new
  `payment_reports:review` permission are notified, can amend details (the
  original submission is kept), then apply — recording a real repayment — or
  reject with a reason sent to the client.
- Co-signer consent: borrowers nominate a co-signer in the portal by exact
  phone number (masked confirmation, no client browsing). Every co-signed loan
  — portal or staff-created — sends the co-signer an SMS/email link; they
  confirm with a one-time code and accept or decline. Loans can't be approved
  until consent is given; on decline/expiry the borrower can nominate someone
  else and staff can resend the link. Borrowers (SMS/email) and approvers
  (in-app) are notified of the response. Co-signers must be active,
  KYC-verified clients.
- Staff "Reported Payments" review queue, "Portal" / "Manual review" badges
  in the loan approval queue, and a per-client portal access toggle.
- New permissions `payment_reports:read` / `payment_reports:review`.

### Changed
- Credit score is shown as a red → amber → green gauge (0–5) with the
  review/pre-approval thresholds marked, on client and loan detail screens
  and the client dashboard.
- Loans record their `source` (`staff` or `portal`).

### Fixed
- Loan API responses now include `createdAt`/`updatedAt` (previously
  undefined because of the `created_at` attribute mapping).

### Security
- Staff routes reject any non-session token. Previously the short-lived
  login OTP challenge token was accepted as a full session, so the OTP step
  could be bypassed.

**Upgrade notes:** run `node backend/scripts/addClientPortalAuth.js` and
`node backend/scripts/addCoSignerConsentStatusToLoans.js`, then
re-run `scripts/seedNotificationTemplates.js`. Grant the new
`payment_reports:*` permissions to the relevant roles (or re-run
`scripts/seedDefaultPermissions.js`, which overwrites roles 1–3 with the
defaults).

For client registration links: run `scripts/seedSystemConfig.js` and
`scripts/seedNotificationTemplates.js`, grant `client_registration_links:*` to
the relevant roles, add `clients` to `SYSTEM_CONFIG_CATEGORIES` and
`VITE_SYSTEM_CONFIG_CATEGORIES` if you override them, and set `TRUST_PROXY`
behind a proxy. New columns and tables are created automatically on boot.
SMS delivery is still a stub, so leave `client.registration.enable_otp` off
until an SMS provider is configured.

## [1.1.0] - 2026-09-06

Second release of Aris LMS, focused on access control, onboarding, and a
scalable notification layer built on top of the v1.0 baseline.

### Added

**Roles, Permissions & Access Control**
- Permission-based access control replacing role-name checks, with a
  configurable permission catalog for fine-grained authorization.
- Refactored roles and permissions for scalable, extensible access management.
- Configurable OTP on login: an admin toggle requires users to enter a
  one-time code (delivered via notification channels) after their password,
  with configurable code length and validity window.

**User Onboarding & Invitations**
- Invite-only registration: admins issue time-limited invitation links with
  email notifications, and invitees self-register through them.
- Invitation lifecycle handling to prevent duplicate invites and manage
  expired invitations.

**Notifications**
- Scalable notification module with reusable notification templates and an
  outbox for managed, auditable delivery.

**Administration & Platform**
- Seeder API endpoint for super admin bootstrapping.
- Hardened Swagger/OpenAPI documentation security.

### Changed
- Updated login page to use the dark logo and refreshed the app logo.
- Updated email header background color to match brand color.

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

[Unreleased]: https://github.com/Opudo-Shaz/arislms/compare/v1.2.0...HEAD
[1.0.0]: https://github.com/Opudo-Shaz/arislms/releases/tag/v1.0.0
[1.1.0]: https://github.com/Opudo-Shaz/arislms/releases/tag/v1.1.0
[1.2.0]: https://github.com/Opudo-Shaz/arislms/releases/tag/v1.2.0

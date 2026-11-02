# Administration workflow implementation

The application follows the 26-process mapping supplied on 29 October 2026. Each
request has its own number, company, process, structured form, target date,
workflow steps, linked records, documents, decisions and event history. Records
are stored in the backend database. The former session-only demo screens are no
longer used by application routes.

## Process coverage

| Mapping | Application area | Implementation |
| --- | --- | --- |
| 1–5 Stationery, equipment purchasing, PR, PO, quotations | Purchasing | Structured item lines, supplier register, linked quotations, comparison, purchase approval, PO creation and PDF, delivery verification and history |
| 6–7 Uniforms and replenishment | Uniforms & Inventory | Design/material/size fields, separate SKUs, receipt/distribution/return/adjustment ledger, low-stock indicators, linked reorder requests |
| 8 Filing | Documents & E-Forms | Company/category/folder fields, uploads, version history, download, search and retention review date |
| 9 E-Forms | Documents & E-Forms | Online forms, generated numbers, supporting files, ordered approval, request history and PDF |
| 10 Payment Advice | Payment Requests | Invoice details, verification, company approval, Finance handoff and recorded payment evidence/reference |
| 11 Utility Bills | Utility Bills | Separate HR-handled, Finance-direct and payment-on-behalf routes; portal link, account/period/due date and reimbursement links |
| 12–13 Insurance and road tax | Insurance & Road Tax | Vehicle/policy/insurance information, renewal steps, expiry calendar, policy documents, reminders and repeat renewal cycles |
| 14–15 Business licences, MOF and CIDB | Licences, MOF & CIDB | Company registers, document checklists, renewal tracking, configurable reminder lead times and updated expiry dates |
| 16 Memos | Memo Approval | Content revisions, approval, controlled distribution, named recipients, acknowledgements and follow-up notices |
| 17–20 Facilities, air conditioning, housekeeping, security and parking | Maintenance | Internal/external route, contractor register, service dates/type, inspection/correction notes, parking/access-card records and history |
| 21–22 Petty cash and claims | Petty Cash | Company/custodian cash accounts, allocations/expenses/replenishments, receipt references, verified claims, approval and Finance queue |
| 23 Document verification | Documents & E-Forms and every request | Required-document categories, version-aware review, duplicate-content detection, correction notes and verifier history |
| 24 Approval Workflow | Approvals | Assigned inbox, configurable company/process rules, ordered approval levels, rejection/changes/resubmission, notices and audit events |
| 25 Finance Handoff | Finance Queue / Payment Requests | Queue visible to Finance/HR, document checks, payment reference/date, paid status, evidence attachments and history |
| 26 Vehicle borrowing | Vehicle Borrowing | Calendar/overlap checks, driver eligibility review, approval, vehicle/key collection condition, inspected return, issue tracking and booking history |

Workflow task completion records work carried out by the responsible person. For
example, ordering from a supplier and downloading a utility bill remain human
tasks. Inventory movements and cash entries are separate ledger operations: link
them to the source request using its numeric ID. Completing a workflow step does
not automatically assume goods arrived or cash changed hands.

## Local startup

The default configuration continues to use MySQL. Apply migrations before starting
an existing installation:

```bash
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python seed.py
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

An opt-in SQLite development instance is available when MySQL is unavailable:

```bash
cd backend
.venv/bin/python run_local.py
```

This uses `backend/hr_admin_dev.sqlite3`, runs the same migrations and seeds the
existing synthetic development accounts. It does not edit `.env` or change an
existing MySQL database. `JWT_SECRET` and `SEED_DEFAULT_PASSWORD` come from the
backend environment; `.env.example` documents configuration.

In another terminal:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Open http://localhost:5173. Start at **Workflow Directory** to find every process.
Use **New record → Save draft → Documents → Submit request**. The record shows
its next step and actions available to the current user. Closed records may be
archived and restored; history and attachments are retained.

## Configure company decisions

Sign in as a system administrator, open **Approvals → Rules**, and configure each
process/company combination. An exact company rule overrides the `*` default.
Enter the approvers in order, required document category names, reminder lead
time, confirmation notes/SOP reference and whether approval is required. A rule
must be confirmed before a request can pass an approval stage. An explicitly
confirmed no-approval rule is also supported. A requestor cannot approve their
own request. Rules are snapshotted when approval is requested; subsequent rule
edits do not change an approval already in progress.

For processes with an amount or purchasing line items, optional **Amount
thresholds** assign a different ordered approval chain. The highest configured
minimum at or below the request total applies; amounts below all thresholds use
the default chain. The request amount and selected minimum are stored with the
approval snapshot. No thresholds are prefilled.

The mapping leaves monetary thresholds, HOB/director responsibilities, Finance
SOPs, retention, driver eligibility criteria and service frequencies unconfirmed.
The rule editor supports process/company approval chains and configurable amount
thresholds. Confirm those choices with HR/Finance before operational rollout.
No company monetary thresholds or retention periods
have been invented. Housekeeping remains an optional process in the directory.

Uploads are stored under `UPLOAD_DIR/workflows`, use opaque storage names and
are downloaded only after record access checks. The configured size limit
defaults to 10 MB. Use the same document category for later versions. The current
version of every attachment must be verified before an approval or verification
stage can complete; required categories come from the confirmed rule. Submitted
versions are retained and recorded in the approval snapshot.

Finance records payments made through the company's existing process; the app
does not connect to a bank or accounting system. A payment reference and date
are required to complete the Finance payment step. Petty cash allocations and
replenishments are restricted to Finance/system administrators; expenses require
the custodian or HR Admin. Stock and cash balances cannot go negative.

## Reminders and optional email

Due-date notices appear in the app using each record's lead time. The suggested
90-day initial value is configurable and is not a company policy. Completed
renewable records continue to generate expiry reminders against the updated
expiry date. Notification read state is stored in the database.

For background reminders, run this daily with the same database settings as the
API:

```bash
cd backend
.venv/bin/python reminders.py
```

To send queued workflow notices and reminders by email, configure `SMTP_HOST`,
`SMTP_PORT`, `SMTP_FROM`, optional `SMTP_USERNAME`/`SMTP_PASSWORD`,
`SMTP_STARTTLS` and `FRONTEND_URL`, then use:

```bash
.venv/bin/python reminders.py --send-email
```

For the opt-in SQLite instance, add
`DATABASE_URL=sqlite:///./hr_admin_dev.sqlite3` to the reminder command. SMTP
delivery and daily scheduling must be configured in the deployment environment;
neither is enabled automatically. No email is sent during tests.

## Verification

Latest verification: **46 API tests passed**, **51 page/viewport checks passed**
at 1280, 390 and 320 pixels, and the production build passed. Browser checks also
completed a filing request with upload/verification/reload and saved/reloaded an
amount-threshold approval rule. MySQL migration SQL generation passed; local
runtime migrations were applied to the separate SQLite development database.

```bash
cd backend
.venv/bin/python -m pytest -q
cd ../frontend
npm run build
```

The API tests use an isolated database and temporary uploads. They cover the full
process catalogue, sequential approvals, correction cycles, server permissions,
required documents, file versions, duplicate documents, stale updates, linked
POs, utility routes, stock/cash balances, notification read state and vehicle
handover. An optional browser harness lives in
`frontend/scripts/workflow-browser-check.mjs`; it uses a disposable API database
(`python -m tests.browser_server`), Vite on 5174 pointed at API port 8011, and an
isolated Firefox WebDriver BiDi session on port 9223.

# NCT PMC HR Admin Management System

Internal HR Administration prototype for NCT PMC Sdn Bhd.

This repository contains a React/Vite frontend and a FastAPI backend with MySQL and opt-in SQLite development support. The supplied 26-process mapping is implemented through persistent requests, approval chains, documents, registers and recorded workflow steps. Company workflows, approval rules, reminder timing, and responsibilities marked `[to confirm]` must be verified before production use. See [the workflow guide](docs/WORKFLOWS.md) for coverage, configuration and verification.

For a local instance without MySQL, run `backend/.venv/bin/python backend/run_local.py`, then `npm run dev` from `frontend`. This uses a separate local SQLite database and preserves the MySQL configuration.

## Local development

### 1. Start the database

The development `.env` expects an isolated MySQL instance on port `3307`. From the project root, use the configured local data directory if it has already been provisioned:

```bash
mysqld --datadir=./database/mysql_data \
  --socket=./database/mysql_run/mysql.sock \
  --port=3307 \
  --bind-address=127.0.0.1
```

Do not point this prototype at a production database.

### 2. Start the backend

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
python seed.py
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

Backend URLs:

- API health: http://127.0.0.1:8010/api/health
- Swagger API docs: http://127.0.0.1:8010/api/docs

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/login.

## Demo accounts

These accounts are for local development only:

```text
admin@nctpmc.com.my / NctDemo#2026
hr@nctpmc.com.my / NctDemo#2026
finance@nctpmc.com.my / NctDemo#2026
approver@nctpmc.com.my / NctDemo#2026
```

Do not use these credentials in production. Production authentication and account management require an approved company decision, such as Microsoft 365 authentication or administrator-managed accounts.

## Current implementation status

- All 26 supplied processes are represented in the Workflow Directory and connected to backend records or the existing vehicle booking module.
- Purchasing, PR/PO, quotations, supplier/contractor records, uniform stock, equipment, petty cash, reimbursement, documents, approvals, payments and maintenance now have working screens and persistent APIs.
- Licence, insurance, road tax and utility records have company registers, calendars, workflow steps, uploads, renewal history and configurable due-date reminders.
- Memo content revisions, ordered approvals, distribution, acknowledgements and follow-up notices are stored in the database.
- Vehicle bookings include driver checks, overlap checks at approval, check-out condition, return inspection, keys and issue recording.
- Dashboard, notifications, search and CSV reports read saved records. Optional SMTP reminders require deployment configuration.
- Server-side authentication and authorization are present for the implemented backend routes. Frontend visibility is not a substitute for backend permission checks.

## Original visual design work (historical)

The notes below describe the earlier UI redesign. Its demo pages are retained as source reference but replaced in the application routes by the persistent workflow screens above. Use [the workflow guide](docs/WORKFLOWS.md) for current behavior and checks.

1. **Layout and design system:** semantic light/dark tokens in `frontend/src/index.css`, shared Card/Badge/Button/DataTable, and a responsive sidebar drawer. Theme choice is saved in this browser; Settings also supports following the system theme.
2. **Dashboard:** filtered KPI links, count-up animation, date-aware attention feed, 7/30/90-day activity chart, and an accessible chart-data table. Demo data is explicitly labelled; the vehicle-request KPI reads the existing API.
3. **Process views:** licence/policy expiries, road-tax dates, bill due dates, Finance-direct badges, vehicle bookings, memo Kanban, step trackers and recorded activity timelines.
4. **Productivity:** Ctrl+K (Cmd+K on macOS) searches navigation and demo records. The bell opens the notification centre. Detail drawers support Escape; bulk demo archive, memo moves and notification read actions offer Undo in a toast.
5. **Accessibility:** semantic headings/labels, visible focus indicators, a skip link, native-dialog focus containment, keyboard alternatives to dragging, reduced-motion support, and chart data available as a table.

The earlier redesign held demo edits in memory. Current workflow records are persisted by the API, including approval, payment, reminder and routing state. Company-specific rules remain `[to confirm]` until an administrator records the confirmed rule.

### Original redesign review notes

Open `/dashboard` after signing in. In browser responsive mode, review widths **1280**, **1024**, **390** and **320** pixels. KPI cards use 3/2/1 columns; mobile navigation opens over the page. Wide tables scroll inside their own container.

- Switch light/dark with the moon/sun button; reload to check persistence.
- Press Ctrl+K, type a page or record name, use arrow keys and Enter to navigate, and Escape to close.
- Open Business Licence, Vehicle Insurance and Utility Bills; try Timeline, Calendar and Table, the filters, month navigation, and record details.
- In Table view, select demo records, archive them, and choose Undo.
- In Memo Approval, move a demo card to an adjacent stage using drag and drop or its Move to selector, then Undo.
- Open Vehicle Borrowing and try the calendar. In a new booking, choose dates/times that overlap a confirmed booking; a conflict warning should appear before saving.
- Enable reduced motion in the OS/browser; count animations and decorative transitions should stop.

The redesign was checked in an isolated Firefox profile with test API responses: 24 layout checks across six pages at the four widths above showed no page-wide horizontal overflow. Keyboard search/focus/Escape, theme persistence, calendar navigation, bulk archive/Undo, memo stage selection and drag/drop, mobile navigation and booking conflict warnings were exercised. The semantic text/status colour pairs exceeded 4.5:1 contrast in both themes. Backend writes were not performed during these checks.

Build check:

```bash
cd frontend
npm run build
```

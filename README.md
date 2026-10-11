# Budget Tool

A multi-tenant budgeting app with two product experiences under one login system: **enterprise budgeting** (departments, per-category approval thresholds, a department-head approval workflow) and **personal budgeting** (bank accounts, paychecks with split allocation, savings goals, debts, bills, and cash-flow projection). A single login can belong to multiple tenants — e.g. your own personal budget plus a company you work at.

## Features

### Shared (both tenant types)
- **Categories** — spending categories with a budgeted amount, an optional per-category approval threshold, and a start date.
- **Transactions** — log spending against a category; an optional recurring flag regenerates new occurrences automatically once due.
- **Dashboard** — budget-vs-actual per category over a selectable month range, with a progress bar and over-budget warning. A department head with access to multiple departments can filter to one department or see them all combined, labeled by department.
- **Approvals** — a transaction over a category's approval threshold is held pending until approved or rejected.
- **Auth** — JWT in an httpOnly cookie, self-serve signup (start a personal budget, start a company, or join an existing company via a join code).

### Enterprise tenants
- **Departments** — a department head is granted access to one or more departments (not necessarily all of them — models a "c-suite sees several but not all" case); an employee belongs to exactly one home department.
- **Team management** — a head assigns/reassigns an employee's department.
- **Approval workflow** — a department head approves or rejects transactions submitted by employees in their departments.

### Personal tenants
- **Bank accounts** — checking/savings/other, with an optional APY on savings accounts.
- **Paychecks** — recurring income (weekly/biweekly/semimonthly/monthly) split across accounts by percentage or fixed amount, with a per-paycheck view of how that pay period covers your category budgets.
- **Savings goals** — a target amount and date, optionally linked to a bank account (vault-style — several goals can share one account), with a computed savings pace.
- **Debts** — balance, interest rate, minimum payment, and due date.
- **Bills** — recurring monthly household bills (rent, utilities, insurance, etc.), can be paused without deleting.
- **Cash-flow projection** — a read-only forward simulation of account balances over N days, combining paycheck splits, recurring transactions, bills, and debt minimums.

## Stack

- **Front end:** Vue 3 + TypeScript, Vite, Vue Router
- **Back end:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (`pg`), hosted on Neon in production
- **Auth:** JWT in an httpOnly cookie (`jsonwebtoken` + `bcryptjs`)
- **Deployment model:** a single Express server serves both the API and the built Vue app from one port — no separate front-end host, no CORS config needed.

## Architecture

**Tenancy model.** `tenants` is the top-level data-isolation boundary — every department, category, and (transitively) every transaction belongs to exactly one tenant. A tenant is either `enterprise` (has departments, joinable via a `join_code`) or `personal` (no departments — categories carry `department_id = NULL` and are scoped by `tenant_id` directly). `tenant_memberships` holds one row per `(user, tenant)` — `role` and `department_id` live here rather than on the user, since one login can belong to several tenants at once (e.g. a personal budget plus a company). Login returns a tenant picker when a user has 2+ memberships; `POST /api/auth/select-tenant` re-issues the session scoped to the chosen tenant.

**Scoping.** `middleware/scoping.ts` is the single source of truth for "what can this user see": an employee is scoped to their one home department; a department head's access is entirely defined by `department_access` grants (no implicit fallback); a personal tenant's `owner` is scoped by `tenant_id` directly, since there are no departments. Every list/write route resolves scope through this module rather than re-deriving it — this is also what lets personal tenants reuse the entire categories/transactions/dashboard/recurring-transactions engine unchanged, with `department_id` simply always `null`.

**Repository pattern.** Route handlers stay thin (validation + a repository call); all SQL lives in `server/src/repositories/`, one module per table/resource. There's no separate service layer — cross-cutting logic is just one repository importing another (e.g. `dashboardRepository` reading `categories`/`transactions` directly, `cashflowRepository` composing four repositories read-only).

## Project Structure

```
/client   — Vue 3 app (Vite)
  src/
    views/         — one page per resource (Dashboard, Transactions, Categories, Approvals,
                      Accounts, Paycheck, Goals, Debts, Bills, Cash Flow, Login, Register, About)
    components/    — reusable form components + NavBar
    composables/   — useAuth (session state), usePendingApprovals
    types/         — one interface per file, grouped by domain
    utils/         — format.ts (currency formatting)
    api.ts         — typed fetch wrapper for the backend API

/server   — Express API + static file server
  src/
    db/            — PostgreSQL pool, versioned SQL migrations, SQLite importer, seed script
    repositories/  — one module per table, all SQL lives here
    routes/        — Express route handlers (thin — validation + repository calls)
    middleware/    — authenticate (JWT/session), scoping (department/tenant access resolution)
    types/         — one interface per file, grouped by domain
    utils/         — dateUtils.ts (recurring/paycheck/debt date math), password.ts, jwt.ts
    server.ts      — app entry point
```

## Local development

Requires Node 22.16+ and Docker. The local database credentials below are disposable development credentials, never production secrets.

```sh
docker compose up -d
export DATABASE_URL='postgresql://budget_test:budget_test_local@127.0.0.1:55432/budget_test'
export JWT_SECRET='local-development-only-change-before-deploying'
npm ci --prefix server
npm ci --prefix client
npm run build --prefix server
npm run db:migrate --prefix server
npm start --prefix server
```

In a second terminal, run `npm run dev --prefix client`. Vite forwards `/api` requests to the local server. For a production-style local preview, run `npm run build --prefix client` and open `http://localhost:3000` instead.

`.env.example` documents variables; export them in the terminal or configure your process manager. Merely copying that file does not load it into your shell. Database migrations are explicit; importing the application never creates tables or seeds users. Sample data is opt-in through `npm run seed --prefix server` and must only be used with a disposable database.

## Durable deployment: Render + Neon

1. Create a Neon PostgreSQL project. Use its pooled connection URL for the application's `DATABASE_URL`, including its TLS parameters. Keep this value on the server; do not put it in a `VITE_` variable.
2. Configure the existing Render web service using `render.yaml` as the reference. The blueprint uses free compute, builds both packages, runs versioned migrations, then starts Express. `/api/health` checks database connectivity.
3. Keep the existing `JWT_SECRET` when updating an existing service. Generate a strong secret for a new service. Set `NODE_ENV=production` so session cookies require HTTPS.
4. Before deploying over a SQLite installation, follow the migration procedure below. Do not redeploy simply to obtain an export: Render's temporary filesystem can disappear during a restart or redeploy.
5. After a deliberate cutover, verify sign-in, memberships, record counts, balances, and a complete create/read/update cycle.

Only the application lives on Render's temporary filesystem. Database content lives in Neon. Free service tiers have resource limits and can change; monitor usage. Do not store uploads or database backups in the application's local filesystem as the only copy.

## Moving an existing SQLite installation

First obtain a consistent export of the running SQLite database using SQLite's backup facility. Store the export outside Render. A raw copy of only the main file while WAL writes are active can omit committed data.

Rehearse against a separate empty PostgreSQL database. Run the build and migrations, then `npm run db:import-sqlite --prefix server -- /absolute/path/to/export.sqlite`. Use `--help` for usage. The importer preserves identifiers and relationships, verifies imported values, and advances identity sequences. It refuses a populated destination rather than overwriting records.

For the final cutover, pause writes to the old deployment, take a fresh consistent export, import into the intended PostgreSQL database, validate the results, and only then deploy the PostgreSQL-backed application. Keep the original SQLite backup. Do not continue writing to both databases: they do not synchronize. A rollback after new PostgreSQL writes requires preserving and reconciling those writes first.

## Backups and recovery

The scheduled GitHub Actions backup workflow creates encrypted PostgreSQL dumps with a 30-day artifact retention period. Configure `BACKUP_DATABASE_URL` and `BACKUP_ENCRYPTION_KEY` in GitHub Actions secrets before enabling it. Use a direct Neon connection for administration/backups where available. Keep the encryption passphrase in a password manager separately from the backup artifact.

Download an additional copy to independent storage periodically. A workflow file alone is not a running backup service: check successful runs, artifact availability, and failure notifications. Scheduled GitHub Actions run from the default branch and can be disabled by inactivity in public repositories.

Restore only into a separate empty PostgreSQL database first. Decrypt the artifact with GnuPG, inspect it with `pg_restore --list`, and restore with `pg_restore --no-owner --no-acl --exit-on-error`. Verify record counts, account totals, and sign-in before changing the live connection. Never test restoration by overwriting the production database.

## Using the App

1. **Sign up** at `/register`: start a personal budget, start a new company, or join an existing company with its join code.
2. **Enterprise:** create categories under a department, log transactions against them, and (as a head) approve or reject anything over a category's approval threshold.
3. **Personal:** add a bank account, set up a paycheck with splits across your accounts, create categories/goals/debts/bills, and check the Cash Flow page to project your balances forward.
4. **Dashboard** shows budget-vs-actual per category for any month range; an enterprise head with multiple departments can filter to one or view them all combined.

All changes are reflected immediately — no page refresh needed.

## API

All routes are prefixed `/api`, return JSON, and (except `/auth`) require an authenticated session.

| Resource | Routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/select-tenant`, `GET /auth/memberships` |
| Departments | `GET/POST /departments` |
| Team | `PATCH /team/:userId` |
| Categories | `GET/POST /categories`, `PUT/DELETE /categories/:id` |
| Transactions | `GET/POST /transactions`, `PUT/DELETE /transactions/:id`, `POST /transactions/:id/approve`, `POST /transactions/:id/reject` |
| Recurring transactions | `GET/POST /recurring-transactions`, `PUT/DELETE /recurring-transactions/:id` |
| Approvals | `GET /approvals` |
| Dashboard | `GET /dashboard` (optional `from`/`to`/`department_id`) |
| Bank accounts | `GET/POST /bank-accounts`, `PUT/DELETE /bank-accounts/:id` |
| Paychecks | `GET/POST /paychecks`, `PUT/DELETE /paychecks/:id` |
| Savings goals | `GET/POST /savings-goals`, `PUT/DELETE /savings-goals/:id` |
| Debts | `GET/POST /debts`, `PUT/DELETE /debts/:id` |
| Bills | `GET/POST /bills`, `PUT/DELETE /bills/:id` |
| Cash flow | `GET /cash-flow` (optional `days`, default 14, capped at 90) |
| Health | `GET /health` (public; checks database connectivity) |

## Notes

- Every PR runs a `test-and-build` CI check (lint + test + build for both server and client) against a disposable PostgreSQL service; `main` has branch protection requiring it to pass.
- Backend tests need `TEST_DATABASE_URL` pointing at a local database with `test` in its name (e.g. the `compose.yaml` one); each test file runs in its own throwaway schema.
- Credit-score estimation is planned but not yet started.

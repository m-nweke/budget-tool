# Budget Tool

A small business budgeting tool: set a budget per spending category, log transactions against those categories, and see budget-vs-actual at a glance on a dashboard.

## Features

- **Categories** — create spending categories with a budgeted amount, edit or delete them.
- **Transactions** — log spending against a category (amount, date, description), edit or delete entries.
- **Recurring transactions** — mark a transaction as "repeat monthly" (e.g. a subscription) instead of re-entering it every month; new occurrences appear automatically once due.
- **Dashboard** — one card per category showing budgeted amount, actual spend, and the difference, with a progress bar and an over-budget warning.

## Stack

- **Front end:** Vue 3 + TypeScript, Vite, Vue Router
- **Back end:** Node.js + Express + TypeScript
- **Database:** SQLite (`better-sqlite3`)
- **Deployment model:** a single Express server serves both the API and the built Vue app from one port — no separate front-end host, no CORS config needed.

## Project Structure

```
/client   — Vue 3 app (Vite)
  src/
    views/        — Dashboard, Transactions, Categories pages
    components/    — reusable form components (CategoryForm, TransactionForm, NavBar)
    types/         — one interface per file, grouped by domain (category/, transaction/, ...)
    utils/         — format.ts (currency formatting)
    api.ts         — typed fetch wrapper for the backend API

/server   — Express API + static file server
  src/
    db/            — SQLite connection + schema (CREATE TABLE IF NOT EXISTS)
    repositories/  — one module per table, all SQL lives here
    routes/        — Express route handlers (thin — validation + repository calls)
    types/         — one interface per file, grouped by domain
    utils/         — dateUtils.ts (recurring-transaction date math)
    server.ts      — app entry point
```

## Running Locally

Requires Node 20+.

```bash
# 1. Build the client
cd client
npm install
npm run build

# 2. Build and run the server (serves the API + the client build above)
cd ../server
npm install
npm run build
npm start
```

Then open **http://localhost:3000**.

For active front-end development with hot reload instead, run `npm run dev` inside `client/` (Vite dev server) alongside `npm start` in `server/` for the API.

The SQLite database file is created automatically on first run at `server/dist/db/budget.sqlite` — no setup needed.

## Using the App

1. **Start with Categories.** The app requires at least one category before you can log a transaction — create one with a name and a budgeted amount (e.g. "Software", $500).
2. **Log a transaction** on the Transactions page: amount, date, description, and which category it belongs to. Check "Repeat monthly" instead if it's a recurring cost like a subscription — it'll regenerate automatically each month without re-entering it.
3. **Check the Dashboard** to see budgeted vs. actual spend per category, with a progress bar and a warning badge if you've gone over budget.

All changes are reflected immediately — no page refresh needed.

## API

All routes are prefixed `/api` and return JSON.

| Resource | Routes |
|---|---|
| Categories | `GET/POST /categories`, `PUT/DELETE /categories/:id` |
| Transactions | `GET/POST /transactions`, `PUT/DELETE /transactions/:id` |
| Recurring transactions | `GET/POST /recurring-transactions`, `DELETE /recurring-transactions/:id` |
| Dashboard | `GET /dashboard` |

## Notes

- No authentication in this build — all endpoints are open. Auth, roles, and department scoping are planned as the next phase (the schema already has forward-compatible `departments`/`users` tables, unused by any route yet).
- See `budget-tool-decisions.md` (not tracked in this repo) for the full log of architecture trade-offs made throughout the build.

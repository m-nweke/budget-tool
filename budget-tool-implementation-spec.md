# Budget Tool — Implementation Spec

Build a small business budgeting tool. This spec covers the MVP scope only (see `budget-tool-decisions.md` for rationale and `budget-tool-architecture.md` for the full stretch roadmap — do not implement anything beyond what's listed here).

## Stack
- Front end: Vue.js (Vue 3)
- Back end: Node.js + Express
- Database: SQLite
- Deployment target: single Node server serves both the API and the built Vue static files

## Project Structure
```
/server
  /db        — SQLite connection + schema init
  /routes    — Express route handlers
  server.js  — Express app entry, serves API + static Vue build
/client      — Vue app (standard Vue 3 project structure)
```

## Database Schema

Create these tables on startup if they don't exist (use `CREATE TABLE IF NOT EXISTS`):

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  budgeted_amount REAL NOT NULL
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  needs_approval INTEGER NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 0
);
```

Note: `needs_approval` / `approved` are included in the schema now for forward compatibility with the phase 5 approval workflow, but no approval logic is implemented in this MVP — always insert transactions with both as `0`/false, and treat every transaction as counted in dashboard totals regardless of these fields.

## API Endpoints

All routes prefixed `/api`. JSON in, JSON out. Return appropriate HTTP status codes (200/201 success, 400 validation error, 404 not found).

| Method | Route | Body | Response |
|---|---|---|---|
| GET | /categories | — | `[{ id, name, budgeted_amount }]` |
| POST | /categories | `{ name, budgeted_amount }` | created category |
| PUT | /categories/:id | `{ name, budgeted_amount }` | updated category |
| DELETE | /categories/:id | — | 204 no content |
| GET | /transactions | — | `[{ id, amount, date, description, category_id }]` |
| POST | /transactions | `{ amount, date, description, category_id }` | created transaction |
| PUT | /transactions/:id | `{ amount, date, description, category_id }` | updated transaction |
| DELETE | /transactions/:id | — | 204 no content |
| GET | /dashboard | — | `[{ category_id, name, budgeted_amount, actual_spend, difference }]` — one row per category, `actual_spend` = sum of that category's transaction amounts, `difference` = `budgeted_amount - actual_spend` |

Validation: `name`/`amount`/`date`/`category_id` are required on create; reject with 400 and a message if missing. Deleting a category that has transactions referencing it should either be blocked (400 with a clear message) or cascade-delete its transactions — pick one and be consistent.

## Front-End Views & Components

- **Nav bar** — links to Dashboard, Transactions, Categories
- **Dashboard view** — fetches `/api/dashboard`, renders one card per category showing name, budgeted amount, actual spend, and difference (highlight in a warning color if `actual_spend > budgeted_amount`)
- **Transactions view** — fetches `/api/transactions` + `/api/categories` (for the category picker/labels), renders a table (date, description, amount, category name) with edit and delete actions per row, and a button to open the transaction form for creating a new one
- **Transaction form** — a single component reused for both create and edit (pass an optional existing transaction as a prop; if present, pre-fill and PUT on submit, otherwise POST); fields: amount (number), date (date picker), description (text), category (select, populated from `/api/categories`)
- **Categories view** — fetches `/api/categories`, renders a list with edit/delete actions and a button to open the category form
- **Category form** — single component reused for create/edit; fields: name (text), budgeted_amount (number)

Routing: use Vue Router with three routes (`/`, `/transactions`, `/categories`) mapped to Dashboard, Transactions, and Categories views respectively.

## Build/Deploy Notes
- Vue build output should be served as static files by the Express server (e.g. `express.static` pointing at the Vue build's `dist` folder), with a catch-all route returning `index.html` for any non-`/api` path so Vue Router works on refresh
- No authentication in this MVP — all endpoints are open
- No environment-specific config needed beyond a port number; SQLite file can live at a fixed path in `/server/db`

## Explicitly Out of Scope for This Build
Auth, users, roles, departments, approval workflow logic, reporting/exports, bank import, notifications, AI features, SMS/OCR integrations. These are documented in `budget-tool-architecture.md` as future phases — do not implement them here.

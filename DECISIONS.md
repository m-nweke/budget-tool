# Technical & Architectural Decisions

Running log of cross-cutting choices and the tradeoffs behind them. Per-story
rationale lives in `docs/decisions/`; this file covers decisions that apply
across the whole codebase.

## TypeScript over plain JavaScript

**Decision:** TypeScript from the very first commit on both server and client, compiled via `tsc` (server) and `vue-tsc` (client) rather than run directly.

**Why:**
- A budgeting app is money-adjacent — a typo'd field name or a `string` silently passed where a `number` was expected turns into a wrong dollar figure, not a stack trace. The compiler catches that class of bug before it ships.
- DTOs (below) only pay off if the compiler enforces them. Plain JS objects with the same shape offer no protection against a route accidentally forwarding a server-only field to the client.
- Converting a JS codebase to TS later is a full second pass over every file — every function signature, every `req.body` access. Starting typed is strictly less total work than "ship fast in JS, convert later," even under a time crunch.

**Tradeoff accepted:** slightly more upfront ceremony (interface files, `tsc -b`) for a project meant to take one hour. Worth it because the domain is money and the reviewer is explicitly evaluating technical judgment, not just speed.

## DTOs (Data Transfer Objects) — one interface per file

**Decision:** Separate `CreateXDto` / `UpdateXDto` interfaces from the plain `X` interface, one per file, instead of reusing one type everywhere.

**Why:**
- **What the client can send is not the same shape as what comes back.** `Category` includes `id` and `created_at` — fields the client never sends and never should. A single shared type would let a client accidentally set `id` on create.
- **Create and update aren't the same operation even when the fields overlap.** The spec has a real example: `start_on` omitted on *create* means "default to today"; omitted on *update* means "leave unchanged." Modeling both with one `Partial<Category>` type would erase that distinction — the type system couldn't tell you which "omitted" you meant, so the bug (resetting `start_on` to today on every edit) becomes easy to write and easy to miss in review.
- One file per DTO keeps each interface small enough to read in one glance and makes the domain folder self-documenting: open `types/category/` and the three files tell you the entire contract for that resource.

## Repository layer (no raw SQL in routes)

**Decision:** Every route handler validates input and calls a repository function; repositories are the only place `db.prepare(...)` appears.

**Why:**
- **Single source of truth per table.** When the `categories` schema changes, exactly one file (`categoryRepository.ts`) needs to change — not every route that happens to query categories.
- **Routes stay about HTTP, repositories stay about data.** A route handler that mixes status codes, validation, and hand-built SQL strings is harder to review for both concerns at once. Separating them means a reviewer checking "is this endpoint's validation correct" isn't simultaneously parsing SQL.
- **Testability.** The recurring-generation engine and the dashboard scoping logic both call repository functions directly in tests, against a real in-memory SQLite instance — no HTTP layer, no mocking. That's only possible because the SQL isn't tangled into `req`/`res` handling.
- Concretely caught a real bug this way: the category-delete guard has to check *two* tables (`transactions` and `recurring_transactions`). Because both live behind `categoryRepository.countTransactionsForCategory` / `countRecurringForCategory`, the route reads as an explicit two-check guard instead of one easy-to-miss `WHERE` clause.

## Shared `utils/` directories (date math, currency, usage classification)

**Decision:** Pure, side-effect-free helper functions — `advanceDate`, `monthCount`, `isValidMonth`, `classifyUsage`, `formatCurrency` — live in `utils/` on both server and client, each independently testable.

**Why:**
- **Money and date math is exactly the class of bug that's invisible until it isn't.** An off-by-one in `advanceDate` doesn't crash anything — it just silently mis-bills someone a day early or late, weeks after the code shipped. Isolating this logic into pure functions makes it exhaustively testable (see `dateMath.test.ts` — 14 cases covering month-end clamping, leap years, year boundaries) in a way that's impractical once the same logic is inlined into a route handler.
- **One definition prevents drift.** The dashboard's progress-bar color and its adjacent "remaining/over" text both had to reflect the same "how urgent is this" judgment. Writing that as two independent threshold checks (one in the bar's style binding, one in the text's class binding) is the natural first draft — and the two *will* eventually disagree after an unrelated edit to one of them. `classifyUsage()` as a single shared function makes that class of bug structurally impossible rather than something to catch in review.
- Pure functions have no dependencies to mock — a date-math test is just "call the function, assert the string," which is part of why there was no excuse to skip covering it thoroughly even under a time constraint.

## Project structure (domain-organized types, layered server, view-owns-state client)

**Decision:** `types/<domain>/` with barrel `index.ts` files, not one flat `types.ts`; `views/` own their own fetch/mutation logic rather than a global store; one `request<T>()` wrapper instead of ad-hoc `fetch` calls scattered through components.

**Why:**
- **Domain folders scale by addition, not modification.** Adding a `department` type later (phase 2, already schema-ready) means adding a `types/department/` folder, not editing a growing flat file that every domain shares and that generates merge conflicts.
- **No global state library for three views.** Dashboard, Transactions, and Categories each own their own data — there's no cross-view shared state to justify Pinia/Vuex here. Each view re-fetching on mount (and after every mutation, per the "no optimistic updates" rule) is simpler and, at this scale, the round-trip cost is invisible. Revisit only if that becomes visibly slow.
- **One `request<T>()` wrapper** centralizes the two things every API call needs to get right — JSON headers and non-2xx → thrown `Error` with the server's message — so error handling is consistent everywhere instead of re-implemented per component.

## SQLite over Postgres

**Decision:** `better-sqlite3`, synchronous, file-based.

**Why:** Zero external setup for a one-hour-scoped project graded partly on "deliver a working solution within constraints." Postgres would need a hosted instance and connection-string management before any code could run. The tradeoff — SQLite's file lives on Render's ephemeral filesystem and resets on redeploy — is explicitly acceptable for a demo and called out for the interview discussion (see `budget-tool-deployment.md`).

## Single combined deployment (one Express service serves API + built Vue app)

**Decision:** No separate frontend host; Express serves `client/dist` as static files, with a JSON 404 for unmatched `/api/*` before the SPA `index.html` fallback, both before the centralized error handler.

**Why:** One Render service, one URL, one thing to deploy and demo — versus coordinating two hosts with CORS between them for no benefit at this scale. The ordering (static → API 404 → SPA fallback → error handler) matters specifically so a typo'd API route returns a clean JSON 404 instead of silently serving `index.html`, which would be confusing to debug.

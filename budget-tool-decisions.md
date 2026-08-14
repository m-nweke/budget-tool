# Budgeting Tool — Architecture Decision Record

A running log of the key technical decisions made while planning this project, why they were made, and what the alternative would have been. Meant as a quick reference for the interview discussion on trade-offs.

---

### 1. Vue.js + Node.js over React + Python
**Decision:** Built the front end in Vue and the back end in Node, despite EnterpriseKC's public listings leaning React/Python in places.
**Why:** This is a 1-hour exercise judged on problem-solving and decision-making, not on matching a specific stack. Vue/Node is the daily-driver stack, so it allows for faster, more confident implementation and deeper discussion of the actual decisions made, rather than fighting an unfamiliar language under time pressure.
**Alternative considered:** React + Python, to mirror what's used internally.

### 2. SQLite over Postgres/MySQL
**Decision:** Used SQLite as the database.
**Why:** Zero setup — no separate database server to provision, configure, or host, which matters directly given the 1-hour constraint. SQLite is a single file that lives alongside the backend code.
**Alternative considered:** Postgres (more production-realistic, and the more common modern choice over MySQL) — noted as the natural swap for a real deployment.

### 3. Single combined deployment (Node serves the built Vue app)
**Decision:** One Node/Express server serves both the API routes and the built Vue static files, deployed as a single service (e.g. Render/Railway free tier).
**Why:** Fewer moving pieces to configure, deploy, and explain within the time box, versus standing up and coordinating two separate hosted services.
**Alternative considered:** Separate frontend (Vercel/Netlify) and backend hosting, communicating over an API — more realistic for a larger production app, but unnecessary overhead here.

### 4. Category management and full transaction CRUD in the MVP, not deferred
**Decision:** Editing/deleting both categories and transactions, plus a dedicated add/edit categories view, is part of the core 1-hour build.
**Why:** A budgeting tool isn't functional without the ability to adjust categories and their targets — this isn't an extra, it's core to the problem being solved.

### 5. Auth, roles, and department scoping deferred to phase 2 (not in the MVP)
**Decision:** User accounts, login, roles, and department-based category scoping are explicitly out of the 1-hour scope, but planned and documented as the immediate next phase.
**Why:** Full auth plus scoping logic is too much to responsibly build and test in an hour on top of the core budgeting flow. Better to ship a fully working, demoable core than a half-finished auth layer bolted onto an incomplete one.
**Alternative considered:** Attempting basic auth within the hour — rejected as too high-risk for the time box.

### 6. Roles as a two-value enum, not a separate roles table
**Decision:** `role` is a `department_head` / `department_employee` enum field directly on the `users` record.
**Why:** With only two fixed values, a join to a separate roles table adds complexity with no real benefit. A roles table would earn its keep if a third or fourth role were ever needed.

### 7. Approval status as booleans on the transaction record, not a separate status/state table
**Decision:** `transactions` carries `needs_approval` and `approved` as boolean fields, rather than a `status` enum or a separate approvals table.
**Why:** Keeps the approval check simple (`needs_approval = true AND approved = false` for the pending queue) and avoids a state-machine table for what's fundamentally a two-step flow. The approval endpoint gates on the existing `role` field rather than introducing new permission infrastructure.

### 8. Configurable per-department approval threshold, not a hardcoded global limit
**Decision:** `approval_threshold` lives on the department/user record and is settable by that department's head via its own endpoint, rather than one fixed dollar amount for the whole app.
**Why:** Departments realistically have different budget sizes and risk tolerances; a single global threshold wouldn't reflect that, and department heads are the right people to own their own threshold.

### 9. Bank import: a normalized staging table with per-bank parsers, not one parser per format hardcoded into the main flow
**Decision:** Introduce a `bank_transactions` staging table with common normalized fields (date, amount, description, external_id, source_format); each bank format gets its own parser function that maps into that shape before anything touches the real `transactions` table.
**Why:** Onboarding a new bank format only means writing a new parser function, not changing the core schema or reconciliation logic. Keeps format-specific messiness isolated from the rest of the app.

### 10. Reconciliation flags ambiguous matches for manual review rather than guessing
**Decision:** Imported bank rows are matched against existing transactions on date + amount + fuzzy description; clean matches auto-confirm, ambiguous ones get a `needs_review` status instead of being silently auto-matched or auto-created.
**Why:** Silently guessing on a financial reconciliation risks duplicate or missing entries — better to surface uncertainty to a human than to be confidently wrong with money.

### 11. Text-to-log, receipt OCR, and AI features scoped out of the build entirely
**Decision:** SMS-based transaction logging, receipt photo OCR, AI-generated insights, and a conversational assistant are documented as future direction but not built, even as stretch phases.
**Why:** These involve external service integration (Twilio, OCR, LLM calls) that would consume the entire 1-hour window on setup alone, with little left to show for the core problem. They're stronger as "here's what I'd add next and why" talking points than as rushed, half-working implementations.

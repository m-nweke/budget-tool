# Story 1: Server Foundation — Why & Tradeoffs

**What shipped:** `server/package.json`, `tsconfig.json`, `vitest.config.ts`, the SQLite schema (`db/index.ts`), and the full set of domain-organized types/DTOs.

## Why this is the first commit

Everything else — repositories, routes, tests — depends on the schema and the types matching it. Building the schema "up front, including forward-compatibility columns for phases described in the roadmap" (per spec) means the `categories`, `transactions`, and `recurring_transactions` tables already have `needs_approval`, `approved`, `created_by`, and `department_id` columns that phase 2/3 features will use — unused today, but avoiding a real `ALTER TABLE` migration later when those phases land.

## Key tradeoff: `start_on` vs `created_at`

`categories.created_at` is a system audit timestamp — set once, never queried. `categories.start_on` is a separate, user-editable business date that the dashboard actually filters on. These look redundant at a glance but solve different problems:

- `created_at` answers "when did this row get inserted" (audit/debugging).
- `start_on` answers "which months' dashboards should this category appear on and get budget-scaled for" — and it's backdatable, so a category created today to retroactively track January spending needs `start_on = 2026-01-01`, not today's date.

Conflating them would make backdating impossible without corrupting the audit trail.

## Why compile with `tsc`, not `ts-node`/`tsx`

Decision carried from `budget-tool-decisions.md` (decision 14): production runs compiled JS (`node dist/server.js`), matching exactly what CI validates and what `npm run build` produces. Running TS directly in prod via a transpile-on-the-fly tool is one more moving part with no benefit once there's a build step.

## Why DTOs are their own commit-worthy decision here

See the root `DECISIONS.md` for the full rationale; the concrete instance that mattered in this story is `UpdateCategoryDto.start_on` being optional with "omitted = unchanged" semantics, versus `CreateCategoryDto.start_on` being optional with "omitted = default to today." Same field name, different type, different meaning — modeled as two separate interfaces specifically so the compiler can't paper over that distinction.

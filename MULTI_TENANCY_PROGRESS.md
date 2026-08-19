# Multi-Tenancy Foundation — Handoff / Progress Doc

**Branch:** `feat/multi-tenancy-foundation`, off `main` (after merging PR #6, the department-roles/approval-workflow PR).

**Read this whole file before touching code.** It's written so a fresh agent/session with zero prior context can resume exactly where this left off — no assumptions, no "as discussed earlier."

## What this feature is

Two things layered onto the existing enterprise budget tool:
1. **True multi-tenancy** — self-serve signup, many isolated tenants, each either `enterprise` (today's department/role/approval model) or `personal` (one person's own budget).
2. **A personal-finance product experience** alongside the enterprise one: paychecks, bank accounts, savings goals, debts, a personal budget, cash-flow simulation. Credit score is explicitly deferred (later phase).

**Full architecture + all 4 phases are written out in detail at:**
`/Users/michaelnweke/.claude-personal/plans/sunny-cooking-nygaard.md`
Read that file first — it has the complete design (schema, auth flow, why each decision was made). This doc only tracks *implementation progress* against that plan; it doesn't repeat the design.

**Confirmed product decisions** (don't re-litigate these — they were explicitly asked and answered):
- Self-serve signup for many users. Employees join an existing company via a **company join code** (no email infra exists).
- **A single login can belong to multiple tenants** (e.g. personal budget + a company). This is why role/department moved off `users` onto a new `tenant_memberships` table, and why auth carries an "active tenant" resolved per-session.
- Credit score is **out of scope for now** (Phase 4, later).
- Sequencing: **Foundation (this branch) → core personal budget → cash-flow simulation → credit score**, each its own PR.

## Phase 1 (Foundation) — what's done so far

**Update 2:** the server side is now **fully done** — functionally complete (manually verified via `curl`, see below) *and* the automated test suite is green: **171/171 server tests passing**, `npm run build` and `npm run lint` both clean. All the old fixture-shape test failures from Update 1 are fixed; new tests were added for the migration, `tenantRepository`, `tenantMembershipRepository`, `register`/`select-tenant`, and `resolveScope`/`userCanAccessResource`. **Only client-side work remains** for this phase (see "Not done yet" below, item 1 — item 2/3/4 from the original list are now done and removed).

**Update 1 (superseded by Update 2 above, kept for history):** the server-side implementation described below is now **functionally complete**. It was manually verified end-to-end via `curl` against a running instance (seed → login as head/personal/join-code registration → select-tenant picker for a multi-membership login → pre-tenant token correctly rejected by tenant-scoped routes → department assignment via the new team endpoint → full cross-tenant data isolation confirmed both directions).

### ✅ Done and verified

- **Schema** (`server/src/db/index.ts`): `tenants`, `tenant_memberships` tables added. `departments`/`categories` gained `tenant_id`. A `runOnce`-guarded migration (`migrate_users_and_departments_to_tenants`) synthesizes a `'Default Company'` tenant for any pre-existing data, creates one `tenant_memberships` row per existing user from their old `role`/`department_id`, backfills `tenant_id` on departments/categories, then drops `role`/`department_id` from `users` via a new `dropColumnIfExists` helper (SQLite 3.53, bundled with this project's better-sqlite3, supports `DROP COLUMN`).
  - **Manually verified** (not yet a committed automated test): ran the migration against a hand-built legacy-shaped SQLite file (old schema, real rows) — correctly created tenant #1, correct membership rows, correct tenant_id backfill, correct column drop. Also verified a **fresh empty database** boots cleanly (no legacy data, migration no-ops correctly) and a **second boot / restart** against an already-migrated db doesn't duplicate anything. See the `db/index.test.ts` pattern from the previous PR (PR #6) for how to write this as a real automated test — **this migration does not have an automated test yet, only manual verification. Add one before this phase is considered done**, following the exact pattern in `server/src/db/index.test.ts` (real on-disk file + `vi.resetModules()` to simulate a restart, since `:memory:` can't exercise this).
- **Types** — new: `server/src/types/tenant/{Tenant,TenantMembership,CreateTenantMembershipDto}.ts` + barrel. Updated: `User.ts` (identity only now — `id, name, email, password_hash`), `CreateUserDto.ts` (dropped `role`/`department_id`), `AuthUser.ts` (now `id, name, email, tenant_id, tenant_type, role, department_id` — role/department_id come from the resolved membership, not a user column), `Category.ts` (added `tenant_id`), `Department.ts` (added `tenant_id`).
- **Repositories**:
  - New `tenantRepository.ts` (`findById`, `findByJoinCode`, `create(name, type)` — generates a `join_code` only for `type='enterprise'`).
  - New `tenantMembershipRepository.ts` (`findByUserAndTenant`, `listForUser`, `create`, `updateDepartment`).
  - `userRepository.ts` — `COLUMNS` no longer includes `role`/`department_id`; `toAuthUser` replaced by `buildAuthUser(user, membership, tenant): AuthUser` (needs all three rows now, since AuthUser's shape spans them).
  - `categoryRepository.ts`, `transactionRepository.ts`, `recurringTransactionRepository.ts`, `dashboardRepository.ts` — every scoped `findAll`/`findSummary` method now takes **both** `departmentIds?: number[]` (enterprise — unchanged behavior, wins when present) **and** `tenantId?: number` (personal — the fallback when `departmentIds` is omitted, since a personal tenant has zero departments and its categories/transactions always have `department_id = NULL`). Omitting both still means "fully unscoped," used only by internal callers (unchanged from before).
  - `categoryRepository.create` signature changed: now `create(dto: CreateCategoryDto, tenantId: number)` — tenant_id is server-derived from `req.user.tenant_id`, never client input, same reasoning as `transactionRepository.create`'s `createdBy` param.
  - `departmentRepository.ts` — done: `tenant_id` added to `COLUMNS`, `create(name, tenantId)` added.
- **`middleware/scoping.ts`**: `resolveAccessibleDepartmentIds` now handles three roles (`department_head`, `department_employee`, `owner` — owner always returns `[]`, which is *correct*, not a bug, since personal tenants have no departments to be "accessible"). `resolveScope(user): { departmentIds?: number[]; tenantId?: number }` — the single place that decides "enterprise → department-scoped, personal → tenant-scoped," used by every GET-list route. New `userCanAccessResource(user, { tenant_id, department_id })` — the unified write-path check (owner → tenant_id match, enterprise → existing department check), used by categories/transactions/recurringTransactions POST/PUT/DELETE.
- **Auth core** (`server/src/utils/jwt.ts`, `server/src/config.ts`, `server/src/routes/auth.ts`, `server/src/middleware/authenticate.ts`) — done and manually verified:
  - `signToken(userId, tenantId)` — JWT payload is now `{ sub, tenant_id }`. New `signPreTenantToken(userId)` — `{ sub }` only, 10-minute expiry (`PRE_TENANT_TOKEN_EXPIRES_IN` in `config.ts`) — issued when login resolves to >1 membership; `authenticate` explicitly rejects any token missing `tenant_id`, so a pre-tenant token can never authenticate a real tenant-scoped route, only `select-tenant`.
  - `authenticate` resolves `req.user` from `(sub, tenant_id)` via `tenantMembershipRepository.findByUserAndTenant` + `tenantRepository.findById`, via `buildAuthUser`. 401 if either is missing.
  - `POST /api/auth/register` (body `{ name, email, password, accountType: 'personal'|'company'|'join', joinCode? }`) — all three paths implemented: personal → new personal tenant + `owner` membership; company → new enterprise tenant (with generated join code) + `department_head` membership; join → look up tenant by code (404 if invalid), find-or-create the user (an existing email must re-verify its password — this is the deliberate multi-tenant case), create an unassigned `department_employee` membership.
  - `POST /api/auth/select-tenant` (body `{ tenant_id }`) — reads the cookie directly (not via `authenticate`, since it must also accept a pre-tenant token), verifies membership, reissues a full session cookie.
  - `POST /api/auth/login` — 1 membership → immediate full session (unchanged UX). 0 or >1 → no cookie set; returns `{ memberships: [...] }` for the client to show a picker before calling `select-tenant`.
- **Routes** — done and manually verified: every GET-list route (`categories`, `transactions`, `recurringTransactions`, `dashboard`) uses `resolveScope`. Category/transaction/recurringTransaction write paths (`POST`/`PUT`/`DELETE`) branch on `user.role === 'owner'` (no `department_id`, `userCanAccessResource` for the tenant check) vs. the existing enterprise logic. `requireRole` calls widened to include `'owner'` where appropriate. New `POST /api/departments` (head-only) and `PATCH /api/team/:userId` (head-only, assigns an employee's `department_id`, validates the department belongs to the head's own tenant). Both mounted in `app.ts`; `register`/`select-tenant` are public (no `authenticate`), same as `login`.
- **`server/src/db/seed.ts`** — rewritten: seeds an enterprise tenant (Acme Co — same head/employee/Engineering+Marketing setup as before, tenant-scoped now) *and* a personal tenant (`owner` role), prints the company's join code to stdout for manual testing.

### ❌ Not done yet — pick up here

Everything server-side is done (schema, auth, routes, seed script, and now the full automated test suite — 171/171 passing, build/lint clean). **Only client-side work remains** for this phase:

1. **Client** (none of this started yet):
   - Registration flow: a new `RegisterView.vue` with account-type choice (personal / start a company / join a company), calling `POST /api/auth/register`. Look at `client/src/views/LoginView.vue` for the existing form/error-handling pattern to match.
   - A tenant-picker UI for the multi-membership login case (`useAuth`'s `login()` needs to handle the `{ memberships: [...] }` response shape instead of always getting a `{ user }` session back — see `server/src/types/auth/LoginResponse.ts` for the exact union type, and mirror it in `client/src/types`).
   - `useAuth` composable (`client/src/composables/useAuth.ts`) gains `tenant`/`tenants` state, plus a `selectTenant(tenantId)` method calling `POST /api/auth/select-tenant`.
   - `NavBar`: a "Switch workspace" affordance, only shown when the user has >1 membership.
   - A personal-mode `NavBar`/route set (deferred detail — Phase 2 per the plan, but the *routing infrastructure* — picking enterprise vs. personal `NavBar`/routes by `tenant_type` — arguably belongs in this foundation phase since Phase 2 depends on it existing). The existing `meta.headOnly` pattern in `client/src/router/index.ts` (from PR #6) is the template for role/type-based route gating — a `meta.tenantType` flag would work the same way.
   - Client-side `Category`/`CreateCategoryDto`/`Transaction` types need `tenant_id` added to mirror the server types (`client/src/types/category/`, `client/src/types/transaction/`) — small, mechanical, but currently missing.
   - `CategoryForm.vue` currently requires selecting a department (`client/src/components/CategoryForm.vue`, from PR #6) — needs a branch for `tenant_type === 'personal'` where there's no department to pick at all (mirrors the server's `owner`-role branch in `routes/categories.ts`).
2. **Docs**: once client work is done, write the usual `docs/stories/NN-*.md` + `docs/decisions/NN-*.md` pair (check `docs/stories/` for the latest number — story 14 was the last one from PR #6) and update `docs/FILE_STRUCTURE.md`, per `CLAUDE.md`'s documented convention.
3. **User also asked for**: a separate doc explaining the general *concept* of multi-tenancy and how this specific solution achieves it — call out which parts are standard/textbook multi-tenancy patterns vs. which parts are specific to this stack's choices (SQLite/better-sqlite3, JWT-in-cookie, Express, the pre-tenant-token bridge for multi-membership login). Not started yet — do this once the phase is otherwise done, so it can describe the actual shipped implementation, not the plan.

## How to verify progress as you go

- `cd server && npm test` — was 111/139 failing before the auth/routes work in this section; re-run to get the current count, then track it to 0 fixing fixtures (item 2 above).
- `cd server && npm run build` and `cd client && npm run build` — must stay clean (`tsc`/`vue-tsc` have caught real bugs already this session, e.g. an index-ordering bug in the schema migration itself — don't skip checking this after schema/type changes).
- The exact manual `curl` sequence that verified the server-side implementation (login/register/select-tenant/scoping/isolation) is in this branch's git log — look at the WIP commit that says "server-side foundation is now functionally complete" for the full transcript of what was run and what it returned.
- Manual verification pattern already used successfully in this project (see the git history for PR #5/#6): seed the db, boot the server on a scratch port (`DB_PATH=/tmp/whatever.sqlite PORT=3993 npm start`), drive it via `curl` or the claude-in-chrome browser tools, then kill the process and delete the scratch db file.
- The plan file's own "Verification (Phase 1)" section has the specific end-to-end manual scenario to run once auth/routes/client are all in place (register a company → create department → get join code → register+join a second account → assign department → confirm scoping; separately register a personal account → confirm isolation; then join-as-existing-email → confirm the tenant picker appears and switching works).

## Known deliberate simplifications (don't "fix" these — they're intentional)

- Dropping `users.role`/`department_id` via `ALTER TABLE ... DROP COLUMN` (not just leaving them vestigial) was a deliberate choice, verified safe on this project's SQLite version (3.53, well past the 3.35 minimum for `DROP COLUMN` support).
- No email-invite flow, no member-removal, no join-code regeneration — explicitly deferred out of Phase 1 per the plan file.
- Credit score is Phase 4, not started, not planned in detail yet.

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
  - `departmentRepository.ts` — **NOT YET UPDATED**. Still has the old `COLUMNS = 'id, name'` (needs `tenant_id` added) and has no `create` method yet (needed for the new "head creates a department" endpoint — see Not Done below).
- **`middleware/scoping.ts`**: `resolveAccessibleDepartmentIds` now handles three roles (`department_head`, `department_employee`, `owner` — owner always returns `[]`, which is *correct*, not a bug, since personal tenants have no departments to be "accessible"). New `resolveScope(user): { departmentIds?: number[]; tenantId?: number }` — the single place that decides "enterprise → department-scoped, personal → tenant-scoped," used by every GET-list route. `userHasDepartmentAccess`/`userHasAccessToAll` are unchanged (still department-only — see Not Done below for why this matters for personal-tenant write paths).

### ❌ Not done yet — pick up here

Work through these in order; each depends on the previous:

1. **`departmentRepository.ts`**: add `tenant_id` to `COLUMNS`, add a `create(name: string, tenantId: number): Department` method (needed for step 5).
2. **`server/src/db/index.test.ts`**: add automated tests for the `migrate_users_and_departments_to_tenants` migration (see "Done and verified" above — this was only manually checked, not covered by an automated test). Also add repo tests for `tenantRepository` and `tenantMembershipRepository` (new files, zero test coverage right now).
3. **Auth core** (`server/src/utils/jwt.ts`, `server/src/routes/auth.ts`, `server/src/middleware/authenticate.ts`):
   - `signToken` needs a `tenantId` param too — JWT payload becomes `{ sub, tenant_id }` (currently just `{ sub }`). `verifyToken` needs to return `tenant_id` too.
   - `authenticate` middleware: after verifying the JWT, load the `tenant_memberships` row for `(sub, tenant_id)` via `tenantMembershipRepository.findByUserAndTenant`, load the `Tenant` via `tenantRepository.findById(tenant_id)`, build `req.user` via `buildAuthUser(user, membership, tenant)`. 401 if either the membership or tenant is gone (e.g. removed since the token was issued).
   - **New `POST /api/auth/register`**: body `{ name, email, password, accountType: 'personal' | 'company' | 'join', joinCode? }`. See the plan file's "Registration" section for the exact three-path logic (personal → new personal tenant + owner membership; company → new enterprise tenant + head membership + generated join code; join → look up tenant by code, create membership on existing-or-new user). All three paths finish by signing a token for the new membership and setting the cookie (reuse the existing login cookie-setting code in `auth.ts`).
   - **New `POST /api/auth/select-tenant`**: body `{ tenant_id }`. Requires the caller to already be authenticated *for some tenant* (or a lighter "pre-tenant" auth state — see plan file) and to actually have a membership in the requested tenant; reissues the cookie with the new `tenant_id` claim.
   - **`POST /api/auth/login` needs to change**: today it signs a token immediately. Needs to become: look up the user's memberships (`tenantMembershipRepository.listForUser`). If exactly 1 → sign token for that tenant immediately (today's UX, unchanged). If 0 → this shouldn't happen (every user has ≥1 membership by construction) but treat as an error. If >1 → **do not** set the session cookie; instead return `{ memberships: [...] }` (each with enough info for a picker — tenant id/name/type) and let the client call `select-tenant` next.
   - `GET /api/auth/me` — unchanged in shape (already returns `{ user: AuthUser }`), but `AuthUser` now includes `tenant_id`/`tenant_type`, so no code change needed there beyond what `authenticate` already produces.
4. **Update every existing route** (`categories.ts`, `transactions.ts`, `recurringTransactions.ts`, `dashboard.ts`, `departments.ts`, `approvals.ts`) to use `resolveScope(user)` instead of `resolveAccessibleDepartmentIds(user)` directly for GET/list endpoints, and pass both `departmentIds`/`tenantId` through to the repo call. **This is the biggest remaining mechanical piece.**
   - **Also**: category/transaction/recurring-transaction **write** paths (`POST`/`PUT`/`DELETE`) currently assume `department_id` is always required and gate creation behind `requireRole('department_head')`. For a personal tenant's `owner`, none of that applies — there's no department to select, and `owner` (not `department_head`) is the role that should be allowed to write. Each write handler needs a role branch:
     ```ts
     if (user.role === 'owner') {
       // no department_id, no userHasDepartmentAccess check — just tenant_id
     } else {
       // existing department_head/department_employee logic, unchanged
     }
     ```
     `requireRole('department_head')` on category management becomes `requireRole('department_head', 'owner')`, then branch inside. Transactions were already open to both `department_head` and `department_employee` — add `'owner'` there too, same branch-inside pattern.
   - `routes/transactions.ts`'s `/:id/approve`/`/:id/reject` and `routes/approvals.ts` stay head-only/enterprise-only — the approval workflow doesn't apply to personal tenants (no threshold concept needed there per the plan; a personal category simply never gets an `approval_threshold` set, so `computeApproval` already auto-approves everything for `owner`-created transactions with zero code changes).
5. **New minimum team-management routes** (see plan file): `POST /api/departments` (head-only, creates in `req.user.tenant_id`), and an employee department-assignment endpoint (head-only, calls `tenantMembershipRepository.updateDepartment`).
6. **`server/src/app.ts`**: mount `POST /api/auth/register` and `POST /api/auth/select-tenant` as public (like login/logout — no `authenticate` gate, since register/select-tenant are how you *get* a session). Mount the new departments-create route under the existing `authenticate`-gated `/api/departments`.
7. **Fix every existing test** — currently **111 of 139 server tests are failing** on this branch (confirmed via `npm test`), almost entirely because test setup code does raw `INSERT INTO users (..., role, department_id, ...)` or calls `userRepository.create({..., role, department_id})`, which no longer compile/work. This is expected and mechanical, not a sign of a design problem — every test file's `beforeEach`/fixture-creation needs to:
   - Create a `tenants` row (or call `tenantRepository.create`).
   - Create the `users` row without `role`/`department_id`.
   - Create a `tenant_memberships` row (or `tenantMembershipRepository.create`) with the role/department_id that used to be inline on the user.
   - Any raw `INSERT INTO categories`/`transactions` in test fixtures needs a `tenant_id` now too (`categories.tenant_id NOT NULL`... actually nullable via migrateColumn for old DBs, but the app-level expectation going forward is every category has one).
   - `server/src/routes/scoping.test.ts` has helper functions `createHead`/`createEmployee`/`loginAs` — these are the highest-leverage place to fix first, since most other route tests reuse them once fixed.
8. **Client** (none of this started yet):
   - Registration flow: a new `RegisterView.vue` with account-type choice (personal / start a company / join a company), calling the new `POST /api/auth/register`.
   - A tenant-picker UI for the multi-membership login case (`useAuth`'s `login()` needs to handle the `{ memberships: [...] }` response shape instead of always getting a session back).
   - `useAuth` composable gains `tenant`/`tenants` state, plus a `selectTenant(tenantId)` method calling the new endpoint.
   - `NavBar`: a "Switch workspace" affordance, only shown when the user has >1 membership.
   - A personal-mode `NavBar`/route set (deferred detail — Phase 2 per the plan, but the *routing infrastructure* — picking enterprise vs. personal `NavBar`/routes by `tenant_type` — arguably belongs in this foundation phase since Phase 2 depends on it existing).
9. **`server/src/db/seed.ts`**: needs a full rewrite — it currently creates users with inline `role`/`department_id` (won't compile). Needs to create a tenant first, then users, then memberships. Should probably keep seeding the same two departments (Engineering/Marketing) and head/employee accounts as today, just tenant-scoped now.
10. **Docs**: once this phase is functionally complete and tests are green, write the usual `docs/stories/NN-*.md` + `docs/decisions/NN-*.md` pair (next number — check `docs/stories/` for the latest, currently story 14 is the last one from PR #6) and update `docs/FILE_STRUCTURE.md`, per this project's documented convention in `CLAUDE.md`.
11. **User also asked for**: once this is done (or at a natural checkpoint), write a separate doc explaining the general *concept* of multi-tenancy and how this specific solution achieves it — call out which parts are standard/textbook multi-tenancy patterns vs. which parts are specific to this stack's choices (SQLite/better-sqlite3, JWT-in-cookie, Express). Not started yet.

## How to verify progress as you go

- `cd server && npm test` — currently 111/139 failing. Track this number down to 0 as you fix test fixtures (item 7).
- `cd server && npm run build` and `cd client && npm run build` — must stay clean (`tsc`/`vue-tsc` have caught real bugs already this session, e.g. an index-ordering bug in the schema migration itself — don't skip checking this after schema/type changes).
- Manual verification pattern already used successfully in this project (see the git history for PR #5/#6): seed the db, boot the server on a scratch port (`DB_PATH=/tmp/whatever.sqlite PORT=3993 npm start`), drive it via `curl` or the claude-in-chrome browser tools, then kill the process and delete the scratch db file.
- The plan file's own "Verification (Phase 1)" section has the specific end-to-end manual scenario to run once auth/routes/client are all in place (register a company → create department → get join code → register+join a second account → assign department → confirm scoping; separately register a personal account → confirm isolation; then join-as-existing-email → confirm the tenant picker appears and switching works).

## Known deliberate simplifications (don't "fix" these — they're intentional)

- Dropping `users.role`/`department_id` via `ALTER TABLE ... DROP COLUMN` (not just leaving them vestigial) was a deliberate choice, verified safe on this project's SQLite version (3.53, well past the 3.35 minimum for `DROP COLUMN` support).
- No email-invite flow, no member-removal, no join-code regeneration — explicitly deferred out of Phase 1 per the plan file.
- Credit score is Phase 4, not started, not planned in detail yet.

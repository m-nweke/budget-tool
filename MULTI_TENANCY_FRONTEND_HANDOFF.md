# Multi-Tenancy Frontend — Remaining Work Handoff (SUPERSEDED — see MULTI_TENANCY_PROGRESS.md)

**This handoff is done.** Everything described below as "what's left" has been completed — see `MULTI_TENANCY_PROGRESS.md`'s "Frontend (`feat/multi-tenancy-frontend`) — done" section for current status, what was found and fixed along the way, and what's still deliberately deferred. Kept here for history; don't use this file's checklist as a to-do list anymore.

**Read this before touching code.** It picks up mid-way through the Phase 1 frontend client work on branch `feat/multi-tenancy-frontend`. For the full feature design, read `/Users/michaelnweke/.claude-personal/plans/sunny-cooking-nygaard.md` first. For backend implementation history, read `MULTI_TENANCY_PROGRESS.md` (that file's "Not done yet" section is now stale — this file supersedes it for what's left).

Branch: `feat/multi-tenancy-frontend`, based on `feat/multi-tenancy-foundation` (backend PR #7, still open — check `gh pr view 7 --json state` before assuming it's merged; if it has merged, consider rebasing onto `main`, but that's not required to keep working).

**Nothing has been committed yet on this branch.** All changes below are uncommitted working-tree edits.

## Done so far (uncommitted, working tree)

Verified with `cd client && npm run build` (clean) after each step below except the NavBar edit, which hasn't been rebuilt yet — do that first.

- `client/src/types/user/AuthUser.ts` — added `tenant_id`, `tenant_type`, `'owner'` role.
- `client/src/types/tenant/{MembershipSummary,index}.ts` — new.
- `client/src/types/category/Category.ts`, `client/src/types/department/Department.ts` — added `tenant_id`.
- `client/src/types/index.ts` — exports `MembershipSummary`.
- `client/src/api.ts` — `AccountType`, `LoginResult` union type; `register`, `selectTenant`, `getMemberships`, `getDepartments`, `createDepartment` added.
- `client/src/composables/useAuth.ts` — full rewrite: `isOwner`, `canManageBudget`, `memberships`, `login()` now returns `boolean` (false = picker), `register()`, `selectTenant()`, `fetchMemberships()`.
- `client/src/views/LoginView.vue` — tenant-picker branch when login returns a picker; link to `/register`.
- `client/src/views/RegisterView.vue` — new: account-type radio cards (personal / company / join), conditional join-code field.
- `client/src/router/index.ts` — `/login` and `/register` routes, generic `meta.public` handling in the guard.
- `client/src/components/NavBar.vue` — just rewritten: adds a "Switch workspace" dropdown (only rendered when `memberships.length > 1`), populated via `fetchMemberships()` on any `user` change. **Not yet build-verified — do this next.**

## Immediate next step

```bash
cd client && npm run build
```

Then manually sanity-check `NavBar.vue` in a browser (see "Manual verification" below) — the workspace-switcher dropdown has never been rendered yet.

## What's left, in order

1. **Verify the NavBar build** (above), fix any TS errors.
2. **`CategoriesView.vue` + `CategoryForm.vue`** (`client/src/components/CategoryForm.vue`, `client/src/views/CategoriesView.vue`):
   - Generalize any `isHead`-only gating to `canManageBudget` (from `useAuth`) — an `owner` on a personal tenant should get the same create/edit/delete affordances a department head gets today.
   - `CategoryForm.vue` needs a branch for `tenant_type === 'personal'` that **skips department selection entirely** — mirrors the server's `owner`-role branch in `server/src/routes/categories.ts` (personal categories always have `department_id: null`).
3. **`TransactionsView.vue`**: delete-transaction permission currently likely checks `isHead` alone — change to `canManageBudget`, matching the server's `requireRole('department_head', 'owner')` on `DELETE /api/transactions/:id`.
4. **Grep for any other `isHead`-only checks in `client/src`** that should really be `canManageBudget` — `CategoryForm.vue`/`CategoriesView.vue`/`TransactionsView.vue` are the known ones from the plan, but do a quick `grep -rn isHead client/src` pass to make sure nothing else was missed (e.g. dashboard filters, approvals-adjacent UI).
5. **`npm run build` + `npm run lint`** clean on `client/` (and confirm `server/` still passes — this branch shouldn't touch `server/src`; if you find yourself needing to, stop and reconsider scope).
6. **Manual end-to-end verification in a browser** (claude-in-chrome tools, or ask the user to drive it) — per this project's standing convention of testing the actual UI before calling frontend work done:
   - Register a personal account → confirm you land on a working dashboard with no department concepts anywhere.
   - Register a company account → confirm you become head, can create a department (note: there is currently **no UI** for `POST /api/departments` — check whether one is expected in this phase per the plan's "routing infrastructure" note, or whether it's still curl/seed-only; this is an open question, use judgment or ask the user).
   - Register a second account via "join" with that company's join code → confirm employee, unassigned department.
   - Log in as an identity with 2+ memberships (e.g. register `join` using an email that already has a personal account) → confirm the login tenant-picker renders and works.
   - Once logged in with 2+ memberships, use the new NavBar "Switch workspace" dropdown → confirm it actually switches active tenant and the UI (nav links, visible data) updates correctly.
7. **Docs** (per `CLAUDE.md` convention — check `docs/stories/` for the latest number; story 15 was the backend PR):
   - `docs/stories/16-multi-tenancy-frontend.md` + `docs/decisions/16-multi-tenancy-frontend.md`.
   - Update `docs/FILE_STRUCTURE.md`.
8. **Update `MULTI_TENANCY_PROGRESS.md`** — mark Phase 1 frontend done, note anything deferred.
9. **Run `/code-review high` on this branch before opening the PR.**
   - **Note:** as of this handoff, two `/code-review high` runs failed immediately with "You've hit your monthly spend limit." This is an account-level Claude usage cap, not a code or task issue — check `claude.ai/settings/usage` or ask the user before retrying, since retrying won't succeed until the limit resets or is raised.
10. **Open the frontend PR**, stacked on PR #7 (`feat/multi-tenancy-foundation`) — note that dependency explicitly in the PR description, same as `MULTI_TENANCY_PROGRESS.md` already documents for how this branch relates to #7. Per the project's standing convention, include screenshots of the new/changed UI (register page, tenant picker, workspace switcher) in the PR body.
11. **Still outstanding, explicitly requested by the user, not started**: a standalone doc explaining the general concept of multi-tenancy and this implementation's specific approach — call out which parts are standard/textbook (tenant table, membership table, per-request scoping) vs. stack-specific (SQLite `DROP COLUMN` migration, JWT-in-cookie, Express middleware, the pre-tenant-token bridge for multi-membership login). Do this once the phase above is otherwise complete, so it documents what actually shipped.
12. **Also deferred, explicitly noted by the user for later** (not part of this phase, don't start): dashboard filtering by department and by specific budget — do this *after* the personal-use multi-tenancy work is fully done.

## Known open question (use judgment, or ask)

The plan file suggested the "routing infrastructure" for enterprise-vs-personal NavBar/route sets arguably belongs in this foundation phase, since Phase 2 depends on it existing. The current working assumption (not confirmed with the user) is that **no separate route tree or NavBar variant is needed yet** — Phase 2's personal-specific views (Accounts/Paycheck/Goals/Debts) don't exist yet, so the existing Dashboard/Transactions/Categories views should just work for `'owner'` role via the `canManageBudget` generalization in items 2–3 above. If this turns out to be wrong once you're testing in the browser (e.g. a personal user sees enterprise-only nav items that make no sense for them), surface it to the user rather than guessing further.

## Reference: don't re-litigate these decisions

- One login can belong to multiple tenants (not 1:1) — deliberate, more complex, explicitly chosen by the user over the simpler alternative.
- Company join codes, not email invites (no email infra exists).
- Credit score is out of scope (Phase 4, far later).
- Personal tenants reuse the entire existing budget engine (categories/transactions/dashboard/recurring/approval-threshold) — no parallel data layer.

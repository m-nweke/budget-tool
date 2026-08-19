import { ref, computed } from 'vue';
import { api, ApiError } from '../api';
import type { AccountType } from '../api';
import type { AuthUser, MembershipSummary } from '../types';

// Module-level singleton, not a per-component ref: every component that
// calls useAuth() shares the same user state, so a login/logout in one
// place (e.g. LoginView) is immediately reflected everywhere (NavBar, the
// router guard) without prop drilling or an event bus. The app is small
// enough that a full store library (Pinia) would be pure overhead.
//
// isHead/fetchMe/login/logout live at module scope too, alongside the
// refs they close over — they don't capture any per-call state, so
// declaring them inside useAuth() would just reallocate them on every
// call (including every router navigation).
const user = ref<AuthUser | null>(null);
const initialized = ref(false);
const isHead = computed(() => user.value?.role === 'department_head');
const isOwner = computed(() => user.value?.role === 'owner');
// Budget-structure management (categories, deleting transactions) is
// gated the same way for both roles — a head owns it for their
// department-scoped tenant, an owner owns it for their whole (department-
// less) personal tenant. Views branch on this instead of `isHead` alone
// wherever the permission, not the specific role, is what matters.
const canManageBudget = computed(() => isHead.value || isOwner.value);
// Approvals are gated the same way as budget management: a head reviews
// department submissions, an owner reviews their own personal-tenant
// submissions (there's no one else to do it) — see routes/transactions.ts
// approve/reject on the server for the matching self-approval carve-out.
const canApprove = computed(() => isHead.value || isOwner.value);

// Shared by two different UI moments: the picker after a multi-membership
// login (nothing else has resolved yet, `user` is still null) and the
// "switch workspace" list for an already-authenticated user (`user` is
// set). Same shape either way — see MembershipSummary.
const memberships = ref<MembershipSummary[]>([]);

// Dedupes concurrent callers (e.g. two router navigations both starting
// before the first /api/auth/me response lands) onto a single in-flight
// request instead of firing one each.
let pendingFetch: Promise<AuthUser | null> | null = null;

// Resolves the current session from the server once per app load (the
// router guard calls this before the first navigation). Safe to call
// again after login/logout to force a re-check.
async function fetchMe(): Promise<AuthUser | null> {
  if (pendingFetch) return pendingFetch;

  pendingFetch = (async () => {
    try {
      const res = await api.getMe();
      user.value = res.user;
      initialized.value = true;
    } catch (e) {
      user.value = null;
      // Only a real 401 confirms "not logged in" — mark resolved so the
      // router guard doesn't re-fetch on every navigation. A network
      // error or 5xx doesn't confirm that; leaving `initialized` false
      // lets the next navigation retry instead of permanently treating a
      // transient failure as a logged-out session for the rest of the SPA
      // session (recoverable today only via a full page reload).
      if (e instanceof ApiError && e.status === 401) {
        initialized.value = true;
      }
    }
    return user.value;
  })();

  try {
    return await pendingFetch;
  } finally {
    pendingFetch = null;
  }
}

// Returns whether the login resolved directly to a session (`true`) or to
// a tenant picker (`false`, and `memberships` is now populated for the
// caller — typically LoginView — to render one). Doesn't throw on the
// picker case; that's a normal outcome, not a failure.
async function login(email: string, password: string): Promise<boolean> {
  const result = await api.login(email, password);
  if ('user' in result) {
    user.value = result.user;
    initialized.value = true;
    memberships.value = [];
    return true;
  }
  memberships.value = result.memberships;
  return false;
}

// Unlike login(), registration always resolves to exactly one new
// membership — never a picker — so this sets the session directly.
async function register(
  name: string,
  email: string,
  password: string,
  accountType: AccountType,
  joinCode?: string
): Promise<void> {
  const res = await api.register(name, email, password, accountType, joinCode);
  user.value = res.user;
  initialized.value = true;
  memberships.value = [];
}

async function selectTenant(tenantId: number): Promise<void> {
  const res = await api.selectTenant(tenantId);
  user.value = res.user;
  initialized.value = true;
  memberships.value = [];
}

// For the "switch workspace" UI — lists every membership the current
// session's identity holds, including the active one. Distinct from the
// picker `memberships` gets populated with during a multi-membership
// login: this is a separate server call (GET /api/auth/memberships),
// since /login's picker only exists before a session is established.
async function fetchMemberships(): Promise<void> {
  const res = await api.getMemberships();
  memberships.value = res.memberships;
}

async function logout(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // Even if the request fails (offline, 5xx), drop the client-side
    // session so the UI doesn't strand the user in an authenticated-looking
    // state with no way to log out. Worst case the server-side cookie
    // outlives this, and a later fetchMe() would re-authenticate them.
  } finally {
    user.value = null;
    memberships.value = [];
  }
}

export function useAuth() {
  return {
    user,
    isHead,
    isOwner,
    canManageBudget,
    canApprove,
    memberships,
    initialized,
    fetchMe,
    login,
    register,
    selectTenant,
    fetchMemberships,
    logout,
  };
}

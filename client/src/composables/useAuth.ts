import { ref, computed } from 'vue';
import { api, ApiError } from '../api';
import type { AuthUser } from '../types';

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

async function login(email: string, password: string): Promise<void> {
  const res = await api.login(email, password);
  user.value = res.user;
  initialized.value = true;
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
  }
}

export function useAuth() {
  return { user, isHead, initialized, fetchMe, login, logout };
}

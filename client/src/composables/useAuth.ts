import { ref, computed } from 'vue';
import { api } from '../api';
import type { AuthUser } from '../types';

// Module-level singleton, not a per-component ref: every component that
// calls useAuth() shares the same user state, so a login/logout in one
// place (e.g. LoginView) is immediately reflected everywhere (NavBar, the
// router guard) without prop drilling or an event bus. The app is small
// enough that a full store library (Pinia) would be pure overhead.
const user = ref<AuthUser | null>(null);
const initialized = ref(false);

export function useAuth() {
  const isHead = computed(() => user.value?.role === 'department_head');

  // Resolves the current session from the server once per app load (the
  // router guard calls this before the first navigation). Safe to call
  // again after login/logout to force a re-check.
  async function fetchMe(): Promise<AuthUser | null> {
    try {
      const res = await api.getMe();
      user.value = res.user;
    } catch {
      user.value = null;
    } finally {
      initialized.value = true;
    }
    return user.value;
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await api.login(email, password);
    user.value = res.user;
    initialized.value = true;
  }

  async function logout(): Promise<void> {
    await api.logout();
    user.value = null;
  }

  return { user, isHead, initialized, fetchMe, login, logout };
}

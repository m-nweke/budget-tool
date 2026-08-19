import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import TransactionsView from '../views/TransactionsView.vue';
import CategoriesView from '../views/CategoriesView.vue';
import ApprovalsView from '../views/ApprovalsView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import { useAuth } from '../composables/useAuth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/transactions', name: 'transactions', component: TransactionsView },
    { path: '/categories', name: 'categories', component: CategoriesView },
    // meta.headOnly is checked generically in the guard below, not
    // special-cased by route name — any future head-only route just needs
    // the same flag, not a new branch in beforeEach.
    { path: '/approvals', name: 'approvals', component: ApprovalsView, meta: { headOnly: true } },
    // meta.public follows the same generic-flag pattern as meta.headOnly
    // below — any future public route (a password-reset page, etc.) just
    // needs the same flag, not a new name check in the guard.
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { public: true } },
    // Catches any unmatched path, including a hand-edited or stale
    // `?redirect=` value from the login flow that no longer resolves to a
    // real route — sends it to the dashboard instead of rendering blank.
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// Resolves the session once (on first navigation, whichever route that is)
// rather than in main.ts before the app even mounts — this way a slow
// /api/auth/me response doesn't delay the initial render, and every
// subsequent navigation reuses the already-resolved user instead of
// re-fetching.
router.beforeEach(async (to) => {
  const { user, isHead, initialized, fetchMe } = useAuth();
  if (!initialized.value) {
    await fetchMe();
  }

  if (!user.value && !to.meta.public) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (user.value && to.meta.public) {
    return { path: '/' };
  }
  // The API already enforces this (approve/reject and GET /api/approvals
  // are head-only), but redirecting here avoids rendering a view that
  // would just show an empty/error state for an employee.
  if (to.meta.headOnly && !isHead.value) {
    return { path: '/' };
  }
});

export default router;

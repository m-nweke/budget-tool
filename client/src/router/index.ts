import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import TransactionsView from '../views/TransactionsView.vue';
import CategoriesView from '../views/CategoriesView.vue';
import LoginView from '../views/LoginView.vue';
import { useAuth } from '../composables/useAuth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/transactions', name: 'transactions', component: TransactionsView },
    { path: '/categories', name: 'categories', component: CategoriesView },
    { path: '/login', name: 'login', component: LoginView },
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
  const { user, initialized, fetchMe } = useAuth();
  if (!initialized.value) {
    await fetchMe();
  }

  if (!user.value && to.name !== 'login') {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (user.value && to.name === 'login') {
    return { path: '/' };
  }
});

export default router;

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { usePendingApprovals } from '../composables/usePendingApprovals';

const { user, canApprove, memberships, logout, fetchMemberships, selectTenant } = useAuth();
const { pending, refresh } = usePendingApprovals();
const router = useRouter();

// Same idiom as CategoryForm.vue's isPersonal — swaps in the Phase 2
// personal-budget nav links alongside the existing tenant-agnostic ones
// (Dashboard/Transactions/Categories all already work for a personal
// tenant unmodified, so they stay as-is). Approvals is deliberately left
// out of the personal-mode nav below — a single-owner tenant only ever
// self-approves its own transactions, which is rare enough that it
// doesn't earn a permanent nav slot; the route/API still work if
// navigated to directly.
const isPersonal = computed(() => user.value?.tenant_type === 'personal');

const workspaceMenuOpen = ref(false);
const workspaceMenuRoot = ref<HTMLElement | null>(null);
const switching = ref(false);

// The personal-only links (7, with Bills and Investments) collapse into this one
// "Budget ▾" trigger on desktop instead of sitting inline — same dropdown
// idiom as the workspace switcher below, just for route links instead of
// tenant switching. Keeps Dashboard/Transactions/Categories as the only
// always-inline items, so the bar doesn't grow with every personal-budget
// feature added.
const budgetMenuOpen = ref(false);
const budgetMenuRoot = ref<HTMLElement | null>(null);

// Separate from budgetMenuOpen: the mobile panel renders every link flat
// (no nested dropdown-inside-a-dropdown), driven by its own hamburger
// toggle rather than reusing the desktop dropdown's state.
const mobileMenuOpen = ref(false);

router.afterEach(() => {
  budgetMenuOpen.value = false;
  mobileMenuOpen.value = false;
});

function toggleBudgetMenu() {
  budgetMenuOpen.value = !budgetMenuOpen.value;
}

function handleClickOutsideBudgetMenu(event: MouseEvent) {
  if (budgetMenuRoot.value && !budgetMenuRoot.value.contains(event.target as Node)) {
    budgetMenuOpen.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleClickOutsideBudgetMenu));
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutsideBudgetMenu));

// Refreshes once someone who can approve (head or personal-tenant owner)
// is known to be logged in (not on every mount — NavBar mounts once for
// the app's lifetime) and again whenever canApprove flips true (e.g.
// right after login), so the badge is populated without ApprovalsView
// needing to have been visited yet. refresh() is async and the watcher
// callback isn't awaited, so a rejection (e.g. a transient network
// failure) must be caught here — otherwise it surfaces as an unhandled
// promise rejection. Best-effort: the badge just stays at whatever it
// last showed until the next successful refresh.
watch(canApprove, (value) => {
  if (value) refresh().catch(() => {});
}, { immediate: true });

// Same reasoning as the isHead/approvals watcher above: populates the
// "switch workspace" list as soon as a session exists, not lazily on
// first dropdown open, so the UI doesn't have to show a loading state
// inside the dropdown. A user with only one membership just never sees
// the switcher (v-if="memberships.length > 1" below).
watch(user, (value) => {
  if (value) fetchMemberships().catch(() => {});
}, { immediate: true });

function toggleWorkspaceMenu() {
  workspaceMenuOpen.value = !workspaceMenuOpen.value;
}

function handleClickOutsideWorkspaceMenu(event: MouseEvent) {
  if (workspaceMenuRoot.value && !workspaceMenuRoot.value.contains(event.target as Node)) {
    workspaceMenuOpen.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleClickOutsideWorkspaceMenu));
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutsideWorkspaceMenu));

async function handleSwitchTenant(tenantId: number) {
  if (tenantId === user.value?.tenant_id) {
    workspaceMenuOpen.value = false;
    return;
  }
  switching.value = true;
  try {
    await selectTenant(tenantId);
    workspaceMenuOpen.value = false;
    // A full page load, not router.push — every view only loads its
    // tenant-scoped data in onMounted, and router.push('/') is a no-op
    // (no remount) when the user switches tenant while already on '/',
    // which would leave the previous tenant's data on screen.
    window.location.href = '/';
  } catch {
    // Best-effort — the dropdown just stays open so the user can retry.
  } finally {
    switching.value = false;
  }
}

async function handleLogout() {
  // logout() itself never throws (it swallows its own request failure so
  // the client-side session always clears) — always navigate away after.
  await logout();
  router.push('/login');
}
</script>

<template>
  <header class="nav-bar">
    <div class="nav-inner">
      <div class="brand-group">
        <RouterLink to="/" class="brand">Budget Tool</RouterLink>
        <span v-if="user" class="mode-pill">{{ isPersonal ? 'Personal' : 'Enterprise' }}</span>
        <RouterLink to="/about" class="about-link">About</RouterLink>
      </div>

      <nav v-if="user" class="nav-links">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/transactions">Transactions</RouterLink>
        <RouterLink to="/categories">Categories</RouterLink>
        <RouterLink v-if="canApprove && !isPersonal" to="/approvals">
          Approvals
          <span v-if="pending.length" class="badge badge-count">{{ pending.length }}</span>
        </RouterLink>
        <div v-if="isPersonal" ref="budgetMenuRoot" class="budget-menu">
          <button
            type="button"
            class="budget-trigger"
            :class="{ 'router-link-exact-active': budgetMenuOpen }"
            @click="toggleBudgetMenu"
          >
            Budget
            <span class="chevron">▾</span>
          </button>
          <ul v-if="budgetMenuOpen" class="budget-dropdown">
            <li><RouterLink to="/accounts">Accounts</RouterLink></li>
            <li><RouterLink to="/paycheck">Paycheck</RouterLink></li>
            <li><RouterLink to="/bills">Bills</RouterLink></li>
            <li><RouterLink to="/investments">Investments</RouterLink></li>
            <li><RouterLink to="/cash-flow">Cash Flow</RouterLink></li>
            <li><RouterLink to="/goals">Goals</RouterLink></li>
            <li><RouterLink to="/debts">Debts</RouterLink></li>
          </ul>
        </div>
      </nav>

      <div v-if="user" class="nav-user">
        <div v-if="memberships.length > 1" ref="workspaceMenuRoot" class="workspace-switcher">
          <button type="button" class="workspace-trigger" @click="toggleWorkspaceMenu">
            <span class="tenant-type-dot" :class="`dot-${user.tenant_type}`" />
            <span class="workspace-trigger-label">{{ memberships.find((m) => m.tenant_id === user!.tenant_id)?.tenant_name }}</span>
            <span class="chevron">▾</span>
          </button>
          <ul v-if="workspaceMenuOpen" class="workspace-dropdown">
            <li v-for="membership in memberships" :key="membership.tenant_id">
              <button
                type="button"
                class="workspace-option"
                :class="{ active: membership.tenant_id === user.tenant_id }"
                :disabled="switching"
                @click="handleSwitchTenant(membership.tenant_id)"
              >
                <span class="tenant-type-dot" :class="`dot-${membership.tenant_type}`" />
                <span>
                  <span class="workspace-option-name">{{ membership.tenant_name }}</span>
                  <span class="workspace-option-meta">{{ membership.tenant_type === 'personal' ? 'Personal budget' : membership.role.replace('_', ' ') }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
        <span class="user-name">{{ user.name }}</span>
        <button type="button" class="btn btn-secondary btn-sm" @click="handleLogout">Log Out</button>
        <button
          type="button"
          class="hamburger"
          :class="{ open: mobileMenuOpen }"
          :aria-expanded="mobileMenuOpen"
          aria-label="Toggle menu"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span /><span /><span />
        </button>
      </div>
    </div>

    <nav v-if="user && mobileMenuOpen" class="mobile-nav">
      <RouterLink to="/">Dashboard</RouterLink>
      <RouterLink to="/transactions">Transactions</RouterLink>
      <RouterLink to="/categories">Categories</RouterLink>
      <RouterLink v-if="canApprove && !isPersonal" to="/approvals">
        Approvals
        <span v-if="pending.length" class="badge badge-count">{{ pending.length }}</span>
      </RouterLink>
      <template v-if="isPersonal">
        <span class="mobile-nav-section">Budget</span>
        <RouterLink to="/accounts">Accounts</RouterLink>
        <RouterLink to="/paycheck">Paycheck</RouterLink>
        <RouterLink to="/bills">Bills</RouterLink>
        <RouterLink to="/investments">Investments</RouterLink>
        <RouterLink to="/cash-flow">Cash Flow</RouterLink>
        <RouterLink to="/goals">Goals</RouterLink>
        <RouterLink to="/debts">Debts</RouterLink>
      </template>
      <RouterLink to="/about">About</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.nav-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.brand-group {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.brand {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
  color: inherit;
  text-decoration: none;
}

.brand:hover {
  color: var(--color-primary);
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  background: var(--color-primary);
  color: #fff;
}

.about-link {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  text-decoration: none;
}

.about-link:hover {
  color: var(--color-primary);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.nav-links a {
  text-decoration: none;
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 0.9rem;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s, color 0.15s;
}

.nav-links a:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.nav-links a.router-link-exact-active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.nav-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-name {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.workspace-switcher {
  position: relative;
}

.workspace-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: inherit;
  font-size: 0.85rem;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  cursor: pointer;
}

.workspace-trigger:hover {
  border-color: var(--color-primary);
}

.chevron {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.workspace-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 220px;
  list-style: none;
  margin: 0;
  padding: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 20;
}

.workspace-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  font: inherit;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.workspace-option:hover {
  background: var(--color-bg);
}

.workspace-option.active {
  background: var(--color-primary-bg);
}

.workspace-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.workspace-option-name {
  display: block;
  font-size: 0.85rem;
  color: var(--color-text);
}

.workspace-option-meta {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.tenant-type-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.dot-enterprise {
  background: var(--color-primary);
}

.dot-personal {
  background: var(--color-warning);
}

.budget-menu {
  position: relative;
}

.budget-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: inherit;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  background: none;
  border: none;
  padding: 7px 10px 7px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.budget-trigger:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.budget-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 160px;
  list-style: none;
  margin: 0;
  padding: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 20;
  animation: dropdown-in 0.12s ease-out;
}

@keyframes dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.budget-dropdown a {
  display: block;
  text-decoration: none;
  color: var(--color-text);
  font-size: 0.88rem;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
}

.budget-dropdown a:hover {
  background: var(--color-bg);
}

.budget-dropdown a.router-link-exact-active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}

.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: var(--color-text);
  border-radius: 1px;
  transition: transform 0.18s, opacity 0.18s;
}

.hamburger.open span:nth-child(1) {
  transform: translateY(6px) rotate(45deg);
}

.hamburger.open span:nth-child(2) {
  opacity: 0;
}

.hamburger.open span:nth-child(3) {
  transform: translateY(-6px) rotate(-45deg);
}

.mobile-nav {
  display: none;
}

@media (max-width: 767px) {
  .nav-links {
    display: none;
  }

  .workspace-trigger-label,
  .user-name {
    display: none;
  }

  .hamburger {
    display: flex;
  }

  .mobile-nav {
    display: flex;
    flex-direction: column;
    padding: var(--space-2) var(--space-5) var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .mobile-nav a {
    text-decoration: none;
    color: var(--color-text-muted);
    font-weight: 500;
    font-size: 0.95rem;
    padding: 11px 4px;
    border-bottom: 1px solid var(--color-border);
  }

  .mobile-nav a.router-link-exact-active {
    color: var(--color-primary);
  }

  .mobile-nav-section {
    margin-top: var(--space-2);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .nav-inner {
    padding: 0 var(--space-4);
  }
}
</style>

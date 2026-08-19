<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { usePendingApprovals } from '../composables/usePendingApprovals';

const { user, canApprove, memberships, logout, fetchMemberships, selectTenant } = useAuth();
const { pending, refresh } = usePendingApprovals();
const router = useRouter();

const workspaceMenuOpen = ref(false);
const workspaceMenuRoot = ref<HTMLElement | null>(null);
const switching = ref(false);

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
      <span class="brand">Budget Tool</span>
      <nav v-if="user" class="nav-links">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/transactions">Transactions</RouterLink>
        <RouterLink to="/categories">Categories</RouterLink>
        <RouterLink v-if="canApprove" to="/approvals">
          Approvals
          <span v-if="pending.length" class="badge badge-count">{{ pending.length }}</span>
        </RouterLink>
      </nav>
      <div v-if="user" class="nav-user">
        <div v-if="memberships.length > 1" ref="workspaceMenuRoot" class="workspace-switcher">
          <button type="button" class="workspace-trigger" @click="toggleWorkspaceMenu">
            <span class="tenant-type-dot" :class="`dot-${user.tenant_type}`" />
            {{ memberships.find((m) => m.tenant_id === user!.tenant_id)?.tenant_name }}
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
      </div>
    </div>
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

.brand {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}

.nav-links {
  display: flex;
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
</style>

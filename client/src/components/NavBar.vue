<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const { user, logout } = useAuth();
const router = useRouter();

async function handleLogout() {
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
      </nav>
      <div v-if="user" class="nav-user">
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
</style>

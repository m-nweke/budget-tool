<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import PasswordField from '../components/PasswordField.vue';

const { login, selectTenant, memberships } = useAuth();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const submitting = ref(false);
// True once a multi-membership login has returned a picker — the form
// above is replaced by the tenant list until one is chosen.
const choosingTenant = ref(false);

function navigateAfterAuth() {
  // Only trust `redirect` if it actually resolves to a route in this app
  // (not the catch-all) — a stale bookmark or hand-edited query value
  // otherwise resolves to nothing meaningful and would leave the UI
  // stranded after navigating.
  let target = '/';
  if (typeof route.query.redirect === 'string') {
    const redirectPath = route.query.redirect;
    if (router.resolve(redirectPath).name !== undefined) {
      target = redirectPath;
    }
  }
  router.push(target);
}

async function handleSubmit() {
  error.value = '';
  submitting.value = true;
  try {
    const authenticated = await login(email.value, password.value);
    if (authenticated) {
      navigateAfterAuth();
    } else {
      // login() populated `memberships` — show the picker instead of
      // navigating; there's no session yet for any route to load.
      choosingTenant.value = true;
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

async function handleSelectTenant(tenantId: number) {
  error.value = '';
  submitting.value = true;
  try {
    await selectTenant(tenantId);
    navigateAfterAuth();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form v-if="!choosingTenant" class="panel login-form" @submit.prevent="handleSubmit">
      <h1>Budget Tool</h1>
      <p>Sign in to continue.</p>

      <p v-if="error" class="alert">{{ error }}</p>

      <label class="field">
        Email
        <input v-model="email" type="email" autocomplete="username" required autofocus />
      </label>
      <label class="field">
        Password
        <PasswordField v-model="password" autocomplete="current-password" />
      </label>

      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? 'Signing in…' : 'Sign In' }}
      </button>

      <p class="register-hint">
        New here? <RouterLink to="/register">Create an account</RouterLink>
      </p>
    </form>

    <div v-else class="panel login-form">
      <h1>Choose a workspace</h1>
      <p>Your account belongs to more than one — pick which to sign in to.</p>

      <p v-if="error" class="alert">{{ error }}</p>

      <ul class="tenant-list">
        <li v-for="membership in memberships" :key="membership.tenant_id">
          <button
            type="button"
            class="tenant-option"
            :disabled="submitting"
            @click="handleSelectTenant(membership.tenant_id)"
          >
            <span class="tenant-name">{{ membership.tenant_name }}</span>
            <span class="tenant-meta">{{ membership.tenant_type === 'personal' ? 'Personal budget' : membership.role.replace('_', ' ') }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  padding-top: var(--space-6);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 340px;
}

.login-form p:not(.alert):not(.register-hint) {
  margin-top: calc(var(--space-4) * -1);
}

.login-form .btn {
  margin-top: var(--space-1);
}

.register-hint {
  margin-top: 0;
  text-align: center;
  font-size: 0.85rem;
}

.tenant-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tenant-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.tenant-option:hover {
  background: var(--color-bg);
  border-color: var(--color-primary);
}

.tenant-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tenant-name {
  font-weight: 600;
  color: var(--color-text);
}

.tenant-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  text-transform: capitalize;
}
</style>

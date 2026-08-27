<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import PasswordField from '../components/PasswordField.vue';
import type { AccountType } from '../api';

const { register, user } = useAuth();
const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
// Starts unselected (not defaulted to 'personal') so the theme preview
// below has a genuine neutral starting point — see the watcher.
const accountType = ref<AccountType | null>(null);
const joinCode = ref('');
const error = ref('');
const submitting = ref(false);

// Live-previews the destination palette as the account type is chosen,
// overriding App.vue's 'neutral' default (set for every logged-out route)
// so picking "Personal budget" or a company path shows the theme you're
// about to land in instead of a jarring swap right after signup. Reset on
// unmount so navigating away without submitting (e.g. back to Login)
// doesn't leave a preview palette applied to an unrelated page.
watch(
  accountType,
  (value) => {
    document.documentElement.dataset.mode = value === 'personal' ? 'personal' : value === null ? 'neutral' : 'enterprise';
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  // Only reset the preview when leaving without an authenticated user
  // (e.g. back to Login). On a successful submit, `register()` already
  // set `user.value`, which App.vue's own watcher used to apply the real
  // mode — unmounting shouldn't clobber that back to 'neutral'.
  if (!user.value) {
    document.documentElement.dataset.mode = 'neutral';
  }
});

async function handleSubmit() {
  // The account-type radios are `required`, so this shouldn't be
  // reachable via a normal submit — guarding anyway since accountType is
  // typed nullable now.
  if (!accountType.value) return;

  error.value = '';
  submitting.value = true;
  try {
    await register(
      name.value,
      email.value,
      password.value,
      accountType.value,
      accountType.value === 'join' ? joinCode.value : undefined
    );
    router.push('/');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="register-page">
    <form class="panel register-form" @submit.prevent="handleSubmit">
      <h1>Budget Tool</h1>
      <p>Create an account to get started.</p>

      <p v-if="error" class="alert">{{ error }}</p>

      <div class="account-type-choices">
        <label class="account-type-option" :class="{ selected: accountType === 'personal' }">
          <input v-model="accountType" type="radio" name="accountType" value="personal" required />
          <span class="account-type-title">Personal budget</span>
          <span class="account-type-desc">Track your own income, spending, and savings.</span>
        </label>
        <label class="account-type-option" :class="{ selected: accountType === 'company' }">
          <input v-model="accountType" type="radio" name="accountType" value="company" />
          <span class="account-type-title">Start a company</span>
          <span class="account-type-desc">You'll be the first department head, with a code to invite your team.</span>
        </label>
        <label class="account-type-option" :class="{ selected: accountType === 'join' }">
          <input v-model="accountType" type="radio" name="accountType" value="join" />
          <span class="account-type-title">Join a company</span>
          <span class="account-type-desc">You have a join code from your department head.</span>
        </label>
      </div>

      <label class="field">
        Name
        <input v-model="name" type="text" autocomplete="name" required />
      </label>
      <label class="field">
        Email
        <input v-model="email" type="email" autocomplete="username" required />
      </label>
      <label class="field">
        Password
        <PasswordField v-model="password" autocomplete="new-password" :minlength="8" />
      </label>
      <label v-if="accountType === 'join'" class="field">
        Join code
        <input v-model="joinCode" type="text" placeholder="e.g. TEAM-4F2K" required />
      </label>

      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? 'Creating account…' : 'Create Account' }}
      </button>

      <p class="login-hint">
        Already have an account? <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </form>
  </div>
</template>

<style scoped>
.register-page {
  display: flex;
  justify-content: center;
  padding-top: var(--space-6);
  padding-bottom: var(--space-6);
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 400px;
}

.register-form p:not(.alert):not(.login-hint) {
  margin-top: calc(var(--space-4) * -1);
}

.register-form .btn {
  margin-top: var(--space-1);
}

.login-hint {
  margin-top: 0;
  text-align: center;
  font-size: 0.85rem;
}

.account-type-choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.account-type-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.account-type-option:has(input:focus-visible) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.account-type-option.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}

.account-type-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.account-type-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
}

.account-type-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>

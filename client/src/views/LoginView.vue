<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const { login } = useAuth();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const submitting = ref(false);

async function handleSubmit() {
  error.value = '';
  submitting.value = true;
  try {
    await login(email.value, password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.push(redirect);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="panel login-form" @submit.prevent="handleSubmit">
      <h1>Budget Tool</h1>
      <p>Sign in to continue.</p>

      <p v-if="error" class="alert">{{ error }}</p>

      <label class="field">
        Email
        <input v-model="email" type="email" autocomplete="username" required autofocus />
      </label>
      <label class="field">
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? 'Signing in…' : 'Sign In' }}
      </button>
    </form>
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

.login-form p:not(.alert) {
  margin-top: calc(var(--space-4) * -1);
}

.login-form .btn {
  margin-top: var(--space-1);
}
</style>

<script setup lang="ts">
import { watch } from 'vue';
import NavBar from './components/NavBar.vue';
import { useAuth } from './composables/useAuth';

const { user } = useAuth();

// Drives style.css's [data-mode="personal"] palette override — set on
// <html> rather than a component root so it repaints every surface (nav,
// buttons, panels) through the same var() names, with no per-component
// awareness that a second palette exists. Falls back to 'enterprise'
// (a no-op selector today) once logged out, so a personal user logging
// out doesn't leave the login/register screens tinted blue.
watch(
  user,
  (value) => {
    document.documentElement.dataset.mode = value?.tenant_type === 'personal' ? 'personal' : 'enterprise';
  },
  { immediate: true }
);
</script>

<template>
  <NavBar />
  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-main {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5);
}
</style>

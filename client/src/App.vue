<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import FinanceShell from './components/FinanceShell.vue';
import NavBar from './components/NavBar.vue';
import { useAuth } from './composables/useAuth';

const { user } = useAuth();
const route = useRoute();
const financeShell = computed(() => route.path.startsWith('/demo') || user.value?.tenant_type === 'personal');

// Drives style.css's [data-mode] palette override — set on <html> rather
// than a component root so it repaints every surface (nav, buttons,
// panels) through the same var() names, with no per-component awareness
// that multiple palettes exist. Falls back to 'neutral' once logged out
// (rather than either brand palette) so login/register/about don't
// presuppose which tenant type a not-yet-authenticated visitor is headed
// toward — RegisterView overrides this locally while its account-type
// selection previews the destination palette.
watch(
  [user, () => route.path],
  ([value]) => {
    if (route.path.startsWith('/demo')) {
      document.documentElement.dataset.mode = 'personal';
    } else if (!value) {
      document.documentElement.dataset.mode = 'neutral';
    } else {
      document.documentElement.dataset.mode = value.tenant_type === 'personal' ? 'personal' : 'enterprise';
    }
  },
  { immediate: true }
);
</script>

<template>
  <FinanceShell v-if="financeShell"><RouterView /></FinanceShell>
  <template v-else><NavBar /><main class="app-main"><RouterView /></main></template>
</template>

<style scoped>
.app-main {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5);
}
</style>

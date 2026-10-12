<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useTheme } from '../composables/useTheme';
import FinanceIcon from './FinanceIcon.vue';
import AppLogo from './AppLogo.vue';
const route = useRoute();
const router = useRouter();
const { user, memberships, fetchMemberships, selectTenant, logout } = useAuth();
const { theme, toggleTheme } = useTheme();
const demo = computed(() => route.path.startsWith('/demo'));
const message = ref('');
const switching = ref(false);
const links = computed(() => [
  { label: 'Overview', icon: 'overview', to: demo.value ? '/demo/overview' : '/' },
  { label: 'Calendar', icon: 'calendar', to: demo.value ? '/demo/calendar' : '/calendar' },
  { label: 'Activity', icon: 'activity', to: demo.value ? '/demo/activity' : '/activity' },
  { label: 'Forecast', icon: 'forecast', to: demo.value ? '/demo/forecast' : '/forecast' },
  { label: 'Plans', icon: 'plans', to: demo.value ? '/demo/plans' : '/plans' },
  { label: 'Accounts', icon: 'accounts', to: demo.value ? '/demo/accounts' : '/ledger' },
]);
watch(user, value => { if (value && !demo.value) fetchMemberships().catch(() => {}); }, { immediate: true });
async function switchWorkspace(event: Event) {
  switching.value = true;
  try { await selectTenant(Number((event.target as HTMLSelectElement).value)); window.location.href = '/'; }
  catch { message.value = 'Unable to switch workspace. Please try again.'; }
  finally { switching.value = false; }
}
async function signOut() { await logout(); await router.push('/login'); }
</script>
<template>
  <div class="finance-shell">
    <a href="#main-content" class="skip-link">Skip to content</a>
    <aside class="finance-sidebar">
      <RouterLink :to="links[0]!.to" class="finance-brand"><AppLogo :size="30"/><span>Budget Tool<span class="brand-subtitle">A little clarity. Every day.</span></span></RouterLink>
      <div class="workspace-identity"><span class="workspace-avatar">{{ demo ? 'A' : user?.name.slice(0,1) }}</span><div><strong>{{ demo ? 'Alex’s workspace' : 'Personal workspace' }}</strong><small>Your money, your direction</small></div></div>
      <nav class="finance-navigation" aria-label="Main navigation"><RouterLink v-for="link in links" :key="link.to" :to="link.to"><FinanceIcon :name="link.icon"/><span>{{ link.label }}</span><span class="nav-active-dot"/></RouterLink></nav>
      <div class="sidebar-bottom">
        <label v-if="!demo && memberships.length > 1" class="field">Workspace<select :value="user?.tenant_id" :disabled="switching" @change="switchWorkspace"><option v-for="membership in memberships" :key="membership.tenant_id" :value="membership.tenant_id">{{ membership.tenant_name }}</option></select></label>
        <p v-if="message" role="alert">{{ message }}</p>
        <RouterLink v-if="!demo" to="/categories" class="sidebar-utility"><FinanceIcon name="activity"/> Categories & budgets</RouterLink>
        <RouterLink v-if="!demo" to="/transactions" class="sidebar-utility"><FinanceIcon name="activity"/> Budget transactions</RouterLink>
        <button class="sidebar-utility" @click="toggleTheme"><FinanceIcon name="sun"/>{{ theme === 'dark' ? 'Light appearance' : 'Dark appearance' }}</button>
        <RouterLink to="/about" class="sidebar-utility">About Budget Tool <FinanceIcon name="arrow"/></RouterLink>
        <button v-if="!demo" class="sidebar-utility" @click="signOut"><FinanceIcon name="logout"/> Sign out</button>
        <div class="sidebar-note"><span class="status-dot"/> {{ demo ? 'A space to explore' : 'A space for your next chapter' }}</div>
      </div>
    </aside>
    <header class="finance-mobile-header"><RouterLink :to="links[0]!.to" class="finance-brand"><AppLogo :size="25"/> Budget Tool</RouterLink><button class="icon-button" @click="toggleTheme" :aria-label="theme === 'dark' ? 'Use light appearance' : 'Use dark appearance'"><FinanceIcon name="sun"/></button><details v-if="!demo" class="mobile-more"><summary>More</summary><div><RouterLink to="/categories">Categories & budgets</RouterLink><RouterLink to="/transactions">Budget transactions</RouterLink><label v-if="memberships.length > 1" class="field">Workspace<select :value="user?.tenant_id" :disabled="switching" @change="switchWorkspace"><option v-for="membership in memberships" :key="membership.tenant_id" :value="membership.tenant_id">{{ membership.tenant_name }}</option></select></label><button @click="signOut">Sign out</button></div></details></header>
    <main id="main-content" class="finance-main" tabindex="-1"><slot/></main>
  </div>
</template>

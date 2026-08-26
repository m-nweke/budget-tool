<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../api';
import { formatCurrency } from '../utils/format';
import { buildDebtSnapshot, type PageSnapshotProps } from '../utils/snapshots';
import { useAuth } from '../composables/useAuth';
import PageSnapshot from '../components/PageSnapshot.vue';
import type { DashboardRow, Department } from '../types';

const { user } = useAuth();
const isPersonal = computed(() => user.value?.tenant_type === 'personal');

const rows = ref<DashboardRow[]>([]);
const error = ref('');
const loaded = ref(false);
const currentMonth = new Date().toISOString().slice(0, 7);
const fromMonth = ref(currentMonth);
const toMonth = ref(currentMonth);
const departments = ref<Department[]>([]);
// '' means "all accessible departments" — kept as a string since a native
// <select> only ever emits strings, converted to a number before the API call.
const selectedDepartmentId = ref('');

// Only worth showing a filter (or per-card labels) once there's more than
// one department to distinguish — a single-department head, an employee,
// and a personal-tenant owner all resolve to exactly one implicit scope.
const showDepartmentFilter = computed(() => departments.value.length > 1);

// Personal tenants only — enterprise has no snapshot-worthy pages (Debts,
// Goals, etc. don't exist for that tenant type), so the toggle and
// snapshot row never render there and the dashboard stays exactly as it
// was before this feature. 'both' is the default so the new snapshot row
// is actually visible rather than hidden behind an extra click; persisted
// to localStorage (client-only, per-browser) so the choice survives a
// reload without needing any server-side settings row.
type ViewMode = 'budgets' | 'snapshots' | 'both';
const viewMode = ref<ViewMode>((() => { try { return (localStorage.getItem('dashboardViewMode') as ViewMode | null) ?? 'both'; } catch { return 'both'; } })());
watch(viewMode, (value) => {
  try {
    localStorage.setItem('dashboardViewMode', value);
  } catch {
    // Best-effort — a private-browsing/storage-disabled context just means
    // the choice doesn't survive a reload, not worth surfacing as an error.
  }
});

const snapshots = ref<PageSnapshotProps[]>([]);

async function loadSnapshots() {
  if (!isPersonal.value) return;
  try {
    // Each entry here is one buildXSnapshot(...) call over that page's own
    // API response — the list grows as more personal-budget pages get a
    // snapshot, with no change needed to this function's shape.
    const debtPlan = await api.getDebtPayoffPlan();
    snapshots.value = [buildDebtSnapshot(debtPlan)].filter((s): s is PageSnapshotProps => s !== null);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function loadDashboard() {
  // Keep the range from ever inverting rather than surfacing a 400 for
  // something the UI itself allowed the user to select.
  if (fromMonth.value > toMonth.value) {
    toMonth.value = fromMonth.value;
    return;
  }
  try {
    const departmentId = selectedDepartmentId.value ? Number(selectedDepartmentId.value) : undefined;
    rows.value = await api.getDashboard(fromMonth.value, toMonth.value, departmentId);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loaded.value = true;
  }
}

async function loadDepartments() {
  try {
    departments.value = await api.getDepartments();
  } catch (e) {
    // GET /api/departments 200s unconditionally for any authenticated user
    // (an empty array for an owner/employee just means no filter is shown —
    // see showDepartmentFilter), so a caught error here is a genuine
    // failure (network/server), not an expected case to swallow quietly.
    error.value = (e as Error).message;
  }
}

function rawUsagePercent(row: DashboardRow): number {
  // A category with no (or negative) budget that still has spend against it
  // is unambiguously over budget — treat that as "high", not "low", so the
  // bar/text tier agrees with the "Over budget" badge/border below instead
  // of contradicting it (green text next to a red badge).
  if (row.budgeted_amount <= 0) return row.actual_spend > 0 ? 100 : 0;
  return (row.actual_spend / row.budgeted_amount) * 100;
}

// Bar width is capped at 100% visually — true overage is communicated via
// the "Over budget" badge/border and the difference text below, not by an
// overflowing bar.
function usagePercent(row: DashboardRow): number {
  return Math.min(100, Math.round(rawUsagePercent(row)));
}

// Uses the uncapped percentage, not usagePercent()'s clamped display value —
// a category at 150% of budget must still read as "high", not silently
// fall back to whatever a 100%-capped number would imply.
function usageLevel(row: DashboardRow): 'low' | 'medium' | 'high' {
  const pct = rawUsagePercent(row);
  if (pct >= 75) return 'high';
  if (pct >= 50) return 'medium';
  return 'low';
}

watch([fromMonth, toMonth, selectedDepartmentId], loadDashboard);
onMounted(() => {
  loadDashboard();
  loadDepartments();
  loadSnapshots();
});
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Dashboard</h1>
      <p>Budget vs. actual spend by category.</p>
    </div>
    <div class="range-picker">
      <div v-if="isPersonal" class="view-mode-toggle">
        <button
          v-for="mode in (['budgets', 'snapshots', 'both'] as const)"
          :key="mode"
          type="button"
          class="view-mode-option"
          :class="{ active: viewMode === mode }"
          @click="viewMode = mode"
        >
          {{ mode === 'budgets' ? 'Budgets' : mode === 'snapshots' ? 'Snapshots' : 'Both' }}
        </button>
      </div>
      <select v-if="showDepartmentFilter" v-model="selectedDepartmentId" class="month-picker">
        <option value="">All departments</option>
        <option v-for="dept in departments" :key="dept.id" :value="String(dept.id)">{{ dept.name }}</option>
      </select>
      <input v-model="fromMonth" type="month" class="month-picker" />
      <span class="range-separator">to</span>
      <input v-model="toMonth" type="month" class="month-picker" />
    </div>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="isPersonal && viewMode !== 'budgets' && snapshots.length" class="snapshot-row">
    <PageSnapshot v-for="snap in snapshots" :key="snap.title" :title="snap.title" :to="snap.to" :stats="snap.stats" />
  </div>

  <template v-if="!isPersonal || viewMode !== 'snapshots'">
    <div v-if="loaded && !rows.length" class="empty-state">
      <h3>Nothing to show yet</h3>
      <p>Create a category and log a transaction to see your budget summary here.</p>
      <RouterLink to="/categories" class="btn btn-primary">Get started</RouterLink>
    </div>

    <div v-else class="card-grid">
    <div
      v-for="row in rows"
      :key="row.category_id"
      class="card budget-card"
      :class="{ over: row.actual_spend > row.budgeted_amount }"
    >
      <div class="budget-card-header">
        <h2>{{ row.name }}</h2>
        <span v-if="row.actual_spend > row.budgeted_amount" class="badge badge-danger">Over Budget</span>
      </div>

      <span
        v-if="showDepartmentFilter && !selectedDepartmentId && row.department_name"
        class="badge badge-department"
        >{{ row.department_name }}</span
      >

      <div class="budget-figures">
        <span class="actual">{{ formatCurrency(row.actual_spend) }}</span>
        <span class="of-budget">of {{ formatCurrency(row.budgeted_amount) }}</span>
      </div>

      <div class="progress-track">
        <div
          class="progress-fill"
          :class="`level-${usageLevel(row)}`"
          :style="{ width: usagePercent(row) + '%' }"
        />
      </div>

      <p class="difference" :class="`level-${usageLevel(row)}`">
        {{ row.difference >= 0 ? `${formatCurrency(row.difference)} remaining` : `${formatCurrency(Math.abs(row.difference))} over` }}
      </p>
    </div>
    </div>
  </template>
</template>

<style scoped>
.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.view-header p {
  margin-top: var(--space-1);
}

.range-picker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.range-separator {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.month-picker {
  font: inherit;
  font-size: 0.9rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}

.view-mode-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.view-mode-option {
  font: inherit;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: none;
  padding: 8px 12px;
  cursor: pointer;
}

.view-mode-option + .view-mode-option {
  border-left: 1px solid var(--color-border);
}

.view-mode-option.active {
  background: var(--color-primary);
  color: #fff;
}

.snapshot-row,
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
}

.snapshot-row {
  margin-bottom: var(--space-5);
}

.budget-card {
  padding: var(--space-5);
}

.budget-card.over {
  border-color: var(--color-danger-border);
}

.budget-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.budget-figures {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.actual {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.of-budget {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: var(--color-bg);
  overflow: hidden;
  margin-bottom: var(--space-3);
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s, background-color 0.2s;
}

.progress-fill.level-low {
  background: var(--color-success);
}

.progress-fill.level-medium {
  background: var(--color-warning);
}

.progress-fill.level-high {
  background: var(--color-danger);
}

.difference {
  font-size: 0.85rem;
  font-weight: 500;
}

.difference.level-low {
  color: var(--color-success);
}

.difference.level-medium {
  color: var(--color-warning);
}

.difference.level-high {
  color: var(--color-danger);
}
</style>

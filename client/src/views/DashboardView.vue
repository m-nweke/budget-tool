<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '../api';
import { formatCurrency } from '../utils/format';
import type { DashboardRow } from '../types';

const rows = ref<DashboardRow[]>([]);
const error = ref('');
const loaded = ref(false);
const currentMonth = new Date().toISOString().slice(0, 7);
const fromMonth = ref(currentMonth);
const toMonth = ref(currentMonth);

async function loadDashboard() {
  // Keep the range from ever inverting rather than surfacing a 400 for
  // something the UI itself allowed the user to select.
  if (fromMonth.value > toMonth.value) {
    toMonth.value = fromMonth.value;
    return;
  }
  try {
    rows.value = await api.getDashboard(fromMonth.value, toMonth.value);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loaded.value = true;
  }
}

function rawUsagePercent(row: DashboardRow): number {
  if (row.budgeted_amount <= 0) return 0;
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

watch([fromMonth, toMonth], loadDashboard);
onMounted(loadDashboard);
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Dashboard</h1>
      <p>Budget vs. actual spend by category.</p>
    </div>
    <div class="range-picker">
      <input v-model="fromMonth" type="month" class="month-picker" />
      <span class="range-separator">to</span>
      <input v-model="toMonth" type="month" class="month-picker" />
    </div>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

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
        <span v-if="row.actual_spend > row.budgeted_amount" class="badge badge-danger">Over budget</span>
      </div>

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

      <p class="difference" :class="{ negative: row.difference < 0 }">
        {{ row.difference >= 0 ? `${formatCurrency(row.difference)} remaining` : `${formatCurrency(Math.abs(row.difference))} over` }}
      </p>
    </div>
  </div>
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

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
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
  color: var(--color-success);
}

.difference.negative {
  color: var(--color-danger);
}
</style>

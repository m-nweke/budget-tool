<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { formatCurrency } from '../format';
import type { DashboardRow } from '../types';

const rows = ref<DashboardRow[]>([]);
const error = ref('');
const loaded = ref(false);

async function loadDashboard() {
  try {
    rows.value = await api.getDashboard();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loaded.value = true;
  }
}

function usagePercent(row: DashboardRow): number {
  if (row.budgeted_amount <= 0) return 0;
  return Math.min(100, Math.round((row.actual_spend / row.budgeted_amount) * 100));
}

onMounted(loadDashboard);
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Dashboard</h1>
      <p>Budget vs. actual spend by category.</p>
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
          :class="{ over: row.actual_spend > row.budgeted_amount }"
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
  margin-bottom: var(--space-5);
}

.view-header p {
  margin-top: var(--space-1);
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
  background: var(--color-primary);
  border-radius: 999px;
  transition: width 0.2s;
}

.progress-fill.over {
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

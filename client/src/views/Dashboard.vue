<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';
import type { DashboardResponse } from '../types';
import { formatCurrency } from '../utils/currency';
import { classifyUsage, cappedPercent } from '../utils/usage';

const data = ref<DashboardResponse | null>(null);
const loaded = ref(false);
const error = ref('');

const from = ref('');
const to = ref('');

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function load() {
  error.value = '';
  if (from.value && to.value && from.value > to.value) {
    error.value = 'From month must be on or before To month.';
    return;
  }
  try {
    data.value = await api.getDashboard(from.value || undefined, to.value || undefined);
    loaded.value = true;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(async () => {
  const m = currentMonth();
  from.value = m;
  to.value = m;
  await load();
});
</script>

<template>
  <div class="page-header">
    <h1>Dashboard</h1>
  </div>

  <div class="filter-bar">
    <label>
      From
      <input type="month" v-model="from" @change="load" />
    </label>
    <label>
      To
      <input type="month" v-model="to" @change="load" />
    </label>
  </div>

  <p v-if="error" class="tier-red">{{ error }}</p>

  <div v-if="loaded && data && data.categories.length === 0" class="empty-state">
    No categories yet. Create one on the Categories page to start tracking budget.
  </div>

  <div v-else-if="loaded && data" class="dashboard-grid">
    <div v-for="c in data.categories" :key="c.id" class="card">
      <h3>{{ c.name }}</h3>
      <div class="progress-track">
        <div
          class="progress-fill"
          :class="`tier-${classifyUsage(c.spent_amount, c.budgeted_amount)}`"
          :style="{ width: cappedPercent(c.spent_amount, c.budgeted_amount) + '%' }"
        />
      </div>
      <p :class="`tier-${classifyUsage(c.spent_amount, c.budgeted_amount)}`">
        {{ formatCurrency(c.spent_amount) }} of {{ formatCurrency(c.budgeted_amount) }}
        <template v-if="c.spent_amount > c.budgeted_amount">
          ({{ formatCurrency(c.spent_amount - c.budgeted_amount) }} over)
        </template>
        <template v-else>
          ({{ formatCurrency(c.budgeted_amount - c.spent_amount) }} remaining)
        </template>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '../api';
import { formatCurrency, accountLabel } from '../utils/format';
import { emojiForOutflow } from '../utils/categoryEmoji';
import type { CashflowProjection } from '../types';

const days = ref(14);
const projection = ref<CashflowProjection | null>(null);
const error = ref('');
const loaded = ref(false);

async function load() {
  error.value = '';
  try {
    projection.value = await api.getCashFlow(days.value);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loaded.value = true;
  }
}

// Re-fetches whenever the window size changes — the whole projection is
// recomputed server-side per request (nothing is cached client-side), same
// as DashboardView re-fetching on its date-range inputs.
watch(days, load);

onMounted(load);

function sourceLabel(source: 'recurring_transaction' | 'debt' | 'bill' | 'investment'): string {
  if (source === 'recurring_transaction') return 'Recurring';
  if (source === 'bill') return 'Bill';
  if (source === 'investment') return 'Investment';
  return 'Debt';
}
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Cash Flow</h1>
      <p>Projected account balances and expected outflows for the next {{ days }} days.</p>
    </div>
    <label class="days-field">
      Days
      <input v-model.number="days" type="number" min="1" max="90" />
    </label>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="loaded && projection && !projection.accounts.length" class="empty-state">
    <h3>No accounts yet</h3>
    <p>Add a bank account to see a projected cash-flow forecast.</p>
  </div>

  <template v-else-if="projection">
    <div class="account-grid">
      <div v-for="account in projection.accounts" :key="account.bank_account_id" class="card account-card">
        <h2>{{ accountLabel(account) }}</h2>
        <p class="starting-balance">Starting balance: <span class="font-mono">{{ formatCurrency(account.starting_balance) }}</span></p>
        <ul class="daily-list">
          <li
            v-for="day in account.daily"
            :key="day.date"
            class="daily-row"
            :class="{ negative: day.balance < 0 }"
          >
            <span class="daily-date">{{ day.date }}</span>
            <span class="daily-credits">
              <span
                v-for="(credit, creditIndex) in day.credits"
                :key="`${credit.paycheck_id}-${creditIndex}`"
                class="badge badge-department"
              >
                +{{ formatCurrency(credit.amount) }} {{ credit.label }}
              </span>
            </span>
            <span class="daily-balance font-mono">{{ formatCurrency(day.balance) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <h2 class="outflows-heading">Upcoming outflows</h2>
    <p class="field-hint">
      Recurring transactions, debt payments, bills, and investment contributions aren't linked to a specific account yet, so they're listed here rather than subtracted from any one balance above.
    </p>
    <div v-if="!projection.outflows.length" class="empty-state">
      <p>Nothing scheduled in this window.</p>
    </div>
    <ul v-else class="outflow-list">
      <li v-for="outflow in projection.outflows" :key="`${outflow.source}-${outflow.id}-${outflow.date}`" class="card outflow-row">
        <span class="outflow-date">{{ outflow.date }}</span>
        <span class="outflow-label">
          <span class="outflow-emoji" aria-hidden="true">{{ emojiForOutflow(outflow.label, outflow.source) }}</span>
          {{ outflow.label }}
          <span class="badge badge-department">{{ sourceLabel(outflow.source) }}</span>
        </span>
        <span class="outflow-amount font-mono">{{ formatCurrency(outflow.amount) }}</span>
      </li>
    </ul>
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

.days-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.days-field input {
  width: 80px;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.account-card {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
}

.account-card h2 {
  font-size: 1.05rem;
  margin-bottom: var(--space-1);
}

.starting-balance {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.daily-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.daily-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 6px 4px;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--color-border);
}

.daily-row.negative .daily-balance {
  color: var(--color-danger);
  font-weight: 600;
}

.daily-date {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.daily-credits {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.daily-balance {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  flex-shrink: 0;
}

.outflows-heading {
  font-size: 1.1rem;
  margin-bottom: var(--space-1);
}

.field-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.outflow-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.outflow-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
}

.outflow-date {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.outflow-emoji {
  font-size: 1.05em;
  margin-right: var(--space-1);
}

.outflow-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
</style>

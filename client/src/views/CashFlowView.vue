<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { api } from '../api';
import { formatCurrency, accountLabel } from '../utils/format';
import BalanceChart from '../components/BalanceChart.vue';
import BankLogo from '../components/BankLogo.vue';
import OutflowCalendar from '../components/OutflowCalendar.vue';
import OutflowBreakdown from '../components/OutflowBreakdown.vue';
import type { AccountProjection, BankAccount, CashflowProjection } from '../types';

const days = ref(14);
const projection = ref<CashflowProjection | null>(null);
// AccountProjection (the simulation's per-account shape) carries no
// institution — it's server-computed from bankAccountRepository without
// that field. Fetched separately here, same "cross-reference by id"
// pattern BillsView/InvestmentsView/GoalsView/PaycheckView already use.
const accounts = ref<BankAccount[]>([]);
const error = ref('');
const loaded = ref(false);
const loading = ref(false);

async function load() {
  error.value = '';
  loading.value = true;
  try {
    const [projectionResult, accountsResult] = await Promise.all([api.getCashFlow(days.value), api.getBankAccounts()]);
    projection.value = projectionResult;
    accounts.value = accountsResult;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loaded.value = true;
    loading.value = false;
  }
}

const accountInstitutionById = computed(() => {
  const map: Record<number, string | null> = {};
  for (const account of accounts.value) {
    map[account.id] = account.institution;
  }
  return map;
});

// Re-fetches whenever the window size changes — the whole projection is
// recomputed server-side per request (nothing is cached client-side), same
// as DashboardView re-fetching on its date-range inputs.
watch(days, load);

onMounted(load);

// Days that actually have incoming paychecks — a sparse subset of the full
// daily list, kept visible as its own compact section so the chart doesn't
// have to try to encode "which days had income" visually. Losing this
// entirely (the chart alone can't show it) would be a real regression the
// prior scrolling list didn't have.
function daysWithCredits(account: AccountProjection) {
  return account.daily.filter((d) => d.credits.length > 0);
}

const cashFlowFrom = computed(() => projection.value?.from ?? '');
const cashFlowTo = computed(() => projection.value?.to ?? '');

// Stretch goal (design doc): collapsed by default — it's a coarse 4-bucket
// breakdown (recurring/bill/debt/investment), not the richer category-level
// Sankey Monarch has (a true Sankey shape was prototyped and dropped —
// see OutflowBreakdown.vue), so it's offered as an optional detail rather
// than forced into the primary view.
const showBreakdown = ref(false);
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Cash Flow</h1>
      <p>Projected account balances and expected outflows for the next {{ days }} days.</p>
    </div>
    <label class="field days-field">
      Days
      <input v-model.number="days" type="number" min="1" max="90" />
    </label>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="loading && !projection" class="empty-state">
    <p>Loading projection…</p>
  </div>

  <div v-else-if="loaded && projection && !projection.accounts.length" class="empty-state">
    <h3>No accounts yet</h3>
    <p>Add a bank account to see a projected cash-flow forecast.</p>
  </div>

  <template v-else-if="projection">
    <div class="account-grid">
      <div v-for="account in projection.accounts" :key="account.bank_account_id" class="card account-card">
        <h2>
          <BankLogo :institution="accountInstitutionById[account.bank_account_id] ?? null" size="1.75rem" />
          {{ accountLabel(account) }}
        </h2>
        <p class="starting-balance">Starting balance: <span class="font-mono">{{ formatCurrency(account.starting_balance) }}</span></p>
        <BalanceChart :daily="account.daily" />
        <div v-if="daysWithCredits(account).length" class="credits-section">
          <p class="credits-heading">Incoming this window</p>
          <ul class="credits-list">
            <li v-for="day in daysWithCredits(account)" :key="day.date" class="credits-row">
              <span class="credits-date">{{ day.date }}</span>
              <span class="daily-credits">
                <span
                  v-for="(credit, creditIndex) in day.credits"
                  :key="`${credit.paycheck_id}-${creditIndex}`"
                  class="badge badge-department"
                >
                  +{{ formatCurrency(credit.amount) }} {{ credit.label }}
                </span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <h2 class="outflows-heading">Upcoming outflows</h2>
    <p class="field-hint">
      Recurring transactions, debt payments, bills, and investment contributions aren't linked to a specific account yet, so they're plotted here by due date rather than subtracted from any one balance above.
    </p>
    <div v-if="!projection.outflows.length" class="empty-state">
      <p>Nothing scheduled in this window.</p>
    </div>
    <template v-else>
      <OutflowCalendar :outflows="projection.outflows" :from="cashFlowFrom" :to="cashFlowTo" />

      <button type="button" class="breakdown-toggle" @click="showBreakdown = !showBreakdown">
        {{ showBreakdown ? 'Hide' : 'Show' }} breakdown by type
        <span class="chevron">{{ showBreakdown ? '▴' : '▾' }}</span>
      </button>
      <div v-if="showBreakdown" class="card breakdown-card">
        <OutflowBreakdown :outflows="projection.outflows" />
      </div>
    </template>
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

/* .field (style.css) supplies the label typography plus the shared
   bordered/focus-ring input look every other form in the app uses — this
   input was missing that class entirely, which is why it looked like a
   bare unstyled number input next to everything else on the page. */
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
  display: flex;
  align-items: center;
  font-size: 1.05rem;
  margin-bottom: var(--space-1);
}

.starting-balance {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.credits-section {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.credits-heading {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.credits-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.credits-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.85rem;
}

.credits-date {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.daily-credits {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
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

.breakdown-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-4);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
}

.breakdown-toggle:hover {
  color: var(--color-text);
}

.breakdown-toggle .chevron {
  font-size: 0.75rem;
}

.breakdown-card {
  margin-top: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
}
</style>

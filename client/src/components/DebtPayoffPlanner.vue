<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { api } from '../api';
import { formatCurrency } from '../utils/format';
import type { Debt, DebtPayoffPlanResponse, DebtPayoffResult, InsufficientMinimums, PayoffStrategy } from '../types';

const props = defineProps<{
  debts: Debt[];
  plan: DebtPayoffPlanResponse;
}>();
const emit = defineEmits<{
  updated: [plan: DebtPayoffPlanResponse];
}>();

const monthlyAmount = ref<number | string>('');
const strategy = ref<PayoffStrategy>('snowball');
// Ordered list of debt ids — only read/sent when strategy === 'custom'.
const customOrder = ref<number[]>([]);
const submitting = ref(false);
const error = ref('');

const sumMinimums = computed(() => props.debts.reduce((sum, d) => sum + d.minimum_payment, 0));

function debtName(id: number): string {
  return props.debts.find((d) => d.id === id)?.name ?? '';
}

// Re-syncs from the latest saved settings whenever the parent gives us a
// fresh plan (initial load, or after a save elsewhere) — and whenever the
// debt list itself changes shape, since a stale custom order (referencing
// a deleted debt id, or missing a newly-added one) needs the same
// self-healing the server already applies, mirrored here so the UI shows
// what the server would actually simulate.
watch(
  () => [props.plan.settings, props.debts] as const,
  ([settings, debts]) => {
    monthlyAmount.value = settings ? settings.monthly_amount : '';
    strategy.value = settings ? settings.strategy : 'snowball';
    const savedOrder = settings?.custom_order ? (JSON.parse(settings.custom_order) as number[]) : [];
    const validIds = new Set(debts.map((d) => d.id));
    const healed = savedOrder.filter((id) => validIds.has(id));
    const missing = debts.filter((d) => !healed.includes(d.id)).map((d) => d.id);
    customOrder.value = [...healed, ...missing];
  },
  { immediate: true }
);

function moveUp(index: number) {
  if (index === 0) return;
  const copy = [...customOrder.value];
  [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
  customOrder.value = copy;
}

function moveDown(index: number) {
  if (index === customOrder.value.length - 1) return;
  const copy = [...customOrder.value];
  [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
  customOrder.value = copy;
}

async function handleSave() {
  error.value = '';
  submitting.value = true;
  try {
    const updated = await api.updateDebtPayoffSettings({
      monthly_amount: Number(monthlyAmount.value),
      strategy: strategy.value,
      order: strategy.value === 'custom' ? customOrder.value : undefined,
    });
    emit('updated', updated);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

const insufficientResult = computed<InsufficientMinimums | null>(() => {
  const plan = props.plan.plan;
  return plan && 'insufficient_minimums' in plan ? plan : null;
});
const payoffResult = computed<DebtPayoffResult | null>(() => {
  const plan = props.plan.plan;
  return plan && !('insufficient_minimums' in plan) ? plan : null;
});
</script>

<template>
  <div class="panel payoff-planner">
    <h2>Debt Payoff Plan</h2>

    <p v-if="error" class="alert">{{ error }}</p>

    <form class="planner-form" @submit.prevent="handleSave">
      <label class="field">
        Monthly amount toward debt
        <input v-model="monthlyAmount" type="number" step="0.01" min="0" placeholder="0.00" required />
      </label>
      <p class="hint">Must be at least {{ formatCurrency(sumMinimums) }} (the sum of every minimum payment).</p>

      <label class="field">
        Strategy
        <select v-model="strategy">
          <option value="snowball">Snowball (lowest balance first)</option>
          <option value="avalanche">Avalanche (highest interest first — minimizes interest)</option>
          <option value="custom">Custom order</option>
        </select>
      </label>

      <div v-if="strategy === 'custom'" class="custom-order">
        <p class="hint">Debts are paid off in this order (top first) once every minimum is covered.</p>
        <ol class="order-list">
          <li v-for="(id, index) in customOrder" :key="id" class="order-row">
            <span>{{ index + 1 }}. {{ debtName(id) }}</span>
            <span class="order-controls">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="index === 0" @click="moveUp(index)">↑</button>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="index === customOrder.length - 1"
                @click="moveDown(index)"
              >
                ↓
              </button>
            </span>
          </li>
        </ol>
      </div>

      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? 'Saving…' : 'Save Plan' }}
      </button>
    </form>

    <div v-if="insufficientResult" class="alert plan-warning">
      Your monthly amount must cover at least the minimum payments
      ({{ formatCurrency(insufficientResult.sum_minimums) }} total) before a payoff plan can be calculated.
    </div>

    <div v-else-if="payoffResult" class="plan-results">
      <div class="result-headline">
        <div>
          <span class="result-label">Debt-free by</span>
          <span class="result-value">{{ payoffResult.debt_free_date }}</span>
        </div>
        <div>
          <span class="result-label">Total interest paid</span>
          <span class="result-value">{{ formatCurrency(payoffResult.total_interest) }}</span>
        </div>
      </div>

      <p v-if="plan.avalanche_comparison && plan.avalanche_comparison.savings > 0" class="avalanche-hint">
        Switching to the Avalanche strategy (highest interest first) would save you
        {{ formatCurrency(plan.avalanche_comparison.savings) }} in interest.
      </p>

      <ul class="per-debt-list">
        <li v-for="row in payoffResult.per_debt" :key="row.debt_id">
          <span class="per-debt-name">{{ row.name }}</span>
          <span class="per-debt-meta">
            paid off {{ row.payoff_date }} · {{ formatCurrency(row.interest_paid) }} interest
          </span>
        </li>
      </ul>
    </div>

    <p class="account-context">Total across your accounts: {{ formatCurrency(plan.total_balance_across_accounts) }}</p>
  </div>
</template>

<style scoped>
.payoff-planner {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.planner-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 420px;
}

.hint {
  font-size: 0.8rem;
  margin-top: calc(var(--space-2) * -1);
}

.custom-order {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.order-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.order-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
}

.order-controls {
  display: flex;
  gap: var(--space-1);
}

.plan-warning {
  margin: 0;
}

.plan-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.result-headline {
  display: flex;
  gap: var(--space-6);
}

.result-headline > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.result-value {
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.avalanche-hint {
  font-size: 0.85rem;
  color: var(--color-warning);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}

.per-debt-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.per-debt-list li {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.per-debt-name {
  font-weight: 600;
}

.per-debt-meta {
  color: var(--color-text-muted);
}

.account-context {
  font-size: 0.8rem;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '../api';
import PaycheckForm from '../components/PaycheckForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useCrudListView } from '../composables/useCrudListView';
import { formatCurrency, capitalize, accountLabel } from '../utils/format';
import type { Paycheck, CreatePaycheckDto, BankAccount, Category, PaycheckFrequency } from '../types';

const accounts = ref<BankAccount[]>([]);
const categories = ref<Category[]>([]);
const expandedAllocationId = ref<number | null>(null);

const {
  items: paychecks,
  showForm,
  editingItem: editingPaycheck,
  error,
  loaded,
  viewTop,
  openCreateForm,
  openEditForm,
  closeForm,
  handleSubmit,
  pendingDelete,
  requestDelete,
  cancelDelete,
  confirmDelete,
} = useCrudListView<Paycheck, CreatePaycheckDto>(
  async () => {
    const [paychecksResult, accountsResult, categoriesResult] = await Promise.all([
      api.getPaychecks(),
      api.getBankAccounts(),
      api.getCategories(),
    ]);
    accounts.value = accountsResult;
    categories.value = categoriesResult;
    return paychecksResult;
  },
  { create: api.createPaycheck, update: api.updatePaycheck, remove: api.deletePaycheck }
);

// How many times a paycheck on this cadence lands per month — used to
// prorate categories.budgeted_amount (a monthly figure) down to "how much
// of this budget does one paycheck need to cover." Semimonthly is exactly
// 2/month (always the 1st and 15th — see stepPaycheckDates on the
// server); weekly/biweekly are averages, since neither divides a month
// evenly.
const PERIODS_PER_MONTH: Record<PaycheckFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  semimonthly: 2,
  monthly: 1,
};

function toggleAllocation(paycheckId: number) {
  expandedAllocationId.value = expandedAllocationId.value === paycheckId ? null : paycheckId;
}

const totalMonthlyBudget = computed(() => categories.value.reduce((sum, c) => sum + c.budgeted_amount, 0));

function allocationFor(paycheck: Paycheck) {
  const periods = PERIODS_PER_MONTH[paycheck.frequency];
  const proratedTotal = totalMonthlyBudget.value / periods;
  return {
    proratedTotal,
    remaining: paycheck.amount - proratedTotal,
    categories: categories.value
      .map((category) => ({ name: category.name, amount: category.budgeted_amount / periods }))
      .sort((a, b) => b.amount - a.amount),
  };
}

const accountNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const account of accounts.value) {
    map[account.id] = accountLabel(account);
  }
  return map;
});

function formatSplit(split: Paycheck['splits'][number]): string {
  const amount = split.split_type === 'percentage' ? `${split.value}%` : formatCurrency(split.value);
  return `${amount} → ${accountNameById.value[split.bank_account_id] ?? 'Unknown account'}`;
}
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Paycheck</h1>
      <p>Schedule paychecks and split them across your accounts.</p>
    </div>
    <button v-if="!showForm && paychecks.length" class="btn btn-primary" @click="openCreateForm">
      + Add Paycheck
    </button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ !editingPaycheck ? 'New Paycheck' : 'Edit Paycheck' }}</h2>
    <PaycheckForm :paycheck="editingPaycheck" @submit="handleSubmit" @cancel="closeForm" />
  </div>

  <div v-if="loaded && !paychecks.length && !showForm" class="empty-state">
    <h3>No paychecks yet</h3>
    <p>Schedule a paycheck to plan how it splits across your accounts.</p>
    <button class="btn btn-primary" @click="openCreateForm">Create your first paycheck</button>
  </div>

  <ul v-else class="paycheck-list">
    <li v-for="paycheck in paychecks" :key="paycheck.id" class="card paycheck-row">
      <div class="paycheck-info">
        <div class="paycheck-name">
          {{ paycheck.label }}
          <span class="badge badge-department">{{ capitalize(paycheck.frequency) }}</span>
        </div>
        <div class="paycheck-meta">
          {{ formatCurrency(paycheck.amount) }} next on {{ paycheck.next_pay_date }}
        </div>
        <ul v-if="paycheck.splits.length" class="split-list">
          <li v-for="split in paycheck.splits" :key="split.id">{{ formatSplit(split) }}</li>
        </ul>
        <button
          v-if="categories.length"
          type="button"
          class="allocation-toggle"
          @click.stop="toggleAllocation(paycheck.id)"
        >
          {{ expandedAllocationId === paycheck.id ? 'Hide' : 'Show' }} budget allocation
          <span class="chevron">{{ expandedAllocationId === paycheck.id ? '▴' : '▾' }}</span>
        </button>
        <div v-if="expandedAllocationId === paycheck.id" class="allocation-panel">
          <div class="allocation-summary">
            <span>Budgeted this period</span>
            <span>{{ formatCurrency(allocationFor(paycheck).proratedTotal) }}</span>
          </div>
          <div class="allocation-summary" :class="{ negative: allocationFor(paycheck).remaining < 0 }">
            <span>{{ allocationFor(paycheck).remaining < 0 ? 'Short by' : 'Left over' }}</span>
            <span>{{ formatCurrency(Math.abs(allocationFor(paycheck).remaining)) }}</span>
          </div>
          <ul class="allocation-categories">
            <li v-for="category in allocationFor(paycheck).categories" :key="category.name">
              <span>{{ category.name }}</span>
              <span>{{ formatCurrency(category.amount) }}</span>
            </li>
          </ul>
        </div>
      </div>
      <KebabMenu @click.stop>
        <button type="button" @click="openEditForm(paycheck)">Edit</button>
        <button type="button" class="danger" @click="requestDelete(paycheck)">Delete</button>
      </KebabMenu>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete paycheck?"
    :message="`This will permanently delete '${pendingDelete?.label}'. This can't be undone.`"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
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

.form-panel {
  margin-bottom: var(--space-5);
}

.form-panel h2 {
  margin-bottom: var(--space-4);
}

.paycheck-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.paycheck-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-4);
  gap: var(--space-4);
}

.paycheck-info {
  flex: 1;
  min-width: 0;
}

.paycheck-name {
  font-weight: 600;
}

.paycheck-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.split-list {
  list-style: none;
  margin: var(--space-2) 0 0;
  padding: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.allocation-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-3);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.allocation-toggle .chevron {
  font-size: 0.7rem;
}

.allocation-panel {
  margin-top: var(--space-3);
  padding: var(--space-3);
  max-width: 340px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  animation: dropdown-in 0.12s ease-out;
}

@keyframes dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.allocation-summary {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 3px 0;
}

.allocation-summary.negative {
  color: var(--color-danger);
}

.allocation-categories {
  list-style: none;
  margin: var(--space-2) 0 0;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.allocation-categories li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>

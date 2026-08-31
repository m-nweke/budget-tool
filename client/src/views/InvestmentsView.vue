<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '../api';
import InvestmentForm from '../components/InvestmentForm.vue';
import BankLogo from '../components/BankLogo.vue';
import KebabMenu from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useCrudListView } from '../composables/useCrudListView';
import { formatCurrency, accountLabel } from '../utils/format';
import type { Investment, CreateInvestmentDto, BankAccount } from '../types';

const TYPE_LABELS: Record<Investment['type'], string> = {
  brokerage: 'Brokerage',
  retirement: 'Retirement',
  crypto: 'Crypto',
  other: 'Other',
};

const TYPE_EMOJI: Record<Investment['type'], string> = {
  brokerage: '📈',
  retirement: '🏛️',
  crypto: '₿',
  other: '💰',
};

const accounts = ref<BankAccount[]>([]);

const {
  items: investments,
  showForm,
  editingItem: editingInvestment,
  formReadonly,
  error,
  loaded,
  viewTop,
  openCreateForm,
  openEditForm,
  openViewForm,
  closeForm,
  handleSubmit,
  pendingDelete,
  requestDelete,
  cancelDelete,
  confirmDelete,
} = useCrudListView<Investment, CreateInvestmentDto>(
  async () => {
    const [investmentsResult, accountsResult] = await Promise.all([api.getInvestments(), api.getBankAccounts()]);
    accounts.value = accountsResult;
    return investmentsResult;
  },
  { create: api.createInvestment, update: api.updateInvestment, remove: api.deleteInvestment }
);

const accountLabelById = computed(() => {
  const map: Record<number, string> = {};
  for (const account of accounts.value) {
    map[account.id] = accountLabel(account);
  }
  return map;
});

const accountInstitutionById = computed(() => {
  const map: Record<number, string | null> = {};
  for (const account of accounts.value) {
    map[account.id] = account.institution;
  }
  return map;
});

const totalValue = computed(() => investments.value.reduce((sum, i) => sum + i.current_value, 0));
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Investments</h1>
      <p>Track brokerage, retirement, and crypto accounts — a recurring contribution folds into your cash-flow simulation.</p>
    </div>
    <button v-if="!showForm && investments.length" class="btn btn-primary" @click="openCreateForm">
      + Add Investment
    </button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ !editingInvestment ? 'New Investment' : formReadonly ? 'View Investment' : 'Edit Investment' }}</h2>
    <InvestmentForm
      :investment="editingInvestment"
      :readonly="formReadonly"
      @submit="handleSubmit"
      @cancel="closeForm"
      @edit="formReadonly = false"
    />
  </div>

  <div v-if="!showForm && investments.length" class="card total-card">
    <span class="total-label">Total tracked value</span>
    <span class="total-value font-mono">{{ formatCurrency(totalValue) }}</span>
  </div>

  <div v-if="loaded && !investments.length && !showForm" class="empty-state">
    <h3>No investments yet</h3>
    <p>Add a brokerage, retirement, or crypto account to start tracking its value.</p>
    <button class="btn btn-primary" @click="openCreateForm">Add your first investment</button>
  </div>

  <ul v-else class="investment-list">
    <li v-for="investment in investments" :key="investment.id" class="card investment-row clickable" @click="openViewForm(investment)">
      <div>
        <div class="investment-name">
          <span class="investment-emoji" aria-hidden="true">{{ TYPE_EMOJI[investment.type] }}</span>
          {{ investment.name }}
          <span class="badge badge-department">{{ TYPE_LABELS[investment.type] }}</span>
          <span v-if="!investment.active" class="badge badge-pending">Excluded</span>
        </div>
        <div class="investment-meta">
          <span class="font-mono">{{ formatCurrency(investment.current_value) }}</span>
          <template v-if="investment.monthly_contribution && investment.contribution_day">
            · <span class="font-mono">{{ formatCurrency(investment.monthly_contribution) }}</span>/mo on the {{ investment.contribution_day }}
          </template>
          <span v-if="investment.bank_account_id" class="linked-account">
            · from <BankLogo :institution="accountInstitutionById[investment.bank_account_id] ?? null" size="1.25rem" />
            {{ accountLabelById[investment.bank_account_id] ?? 'Unknown account' }}
          </span>
        </div>
      </div>
      <KebabMenu @click.stop>
        <button type="button" @click="openEditForm(investment)">Edit</button>
        <button type="button" class="danger" @click="requestDelete(investment)">Delete</button>
      </KebabMenu>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete investment?"
    :message="`This will permanently delete '${pendingDelete?.name}'. This can't be undone.`"
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

.total-card {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-5);
}

.total-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.total-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-success);
}

.investment-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.investment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
}

.investment-emoji {
  font-size: 1.05em;
  margin-right: var(--space-1);
}

.investment-row.clickable {
  cursor: pointer;
}

.investment-row.clickable:hover {
  border-color: var(--color-primary);
}

.investment-name {
  font-weight: 600;
}

.linked-account {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.investment-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

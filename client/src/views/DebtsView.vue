<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '../api';
import DebtForm from '../components/DebtForm.vue';
import DebtPayoffPlanner from '../components/DebtPayoffPlanner.vue';
import KebabMenu from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useCrudListView } from '../composables/useCrudListView';
import { formatCurrency } from '../utils/format';
import { buildDebtSnapshot } from '../utils/snapshots';
import type { Debt, CreateDebtDto, DebtPayoffPlanResponse } from '../types';

const payoffPlan = ref<DebtPayoffPlanResponse | null>(null);

const {
  items: debts,
  showForm,
  editingItem: editingDebt,
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
} = useCrudListView<Debt, CreateDebtDto>(
  async () => {
    const [debtsResult, planResult] = await Promise.all([api.getDebts(), api.getDebtPayoffPlan()]);
    payoffPlan.value = planResult;
    return debtsResult;
  },
  { create: api.createDebt, update: api.updateDebt, remove: api.deleteDebt }
);

const snapshot = computed(() => (payoffPlan.value ? buildDebtSnapshot(payoffPlan.value) : null));
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Debts</h1>
      <p>Track balances, rates, and minimum payments.</p>
    </div>
    <button v-if="!showForm && debts.length" class="btn btn-primary" @click="openCreateForm">+ Add Debt</button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ !editingDebt ? 'New Debt' : formReadonly ? 'View Debt' : 'Edit Debt' }}</h2>
    <DebtForm
      :debt="editingDebt"
      :readonly="formReadonly"
      @submit="handleSubmit"
      @cancel="closeForm"
      @edit="formReadonly = false"
    />
  </div>

  <div v-if="!showForm && snapshot" class="snapshot-row">
    <div v-for="stat in snapshot.stats" :key="stat.label" class="card snapshot-card">
      <span class="snapshot-label">{{ stat.label }}</span>
      <span class="snapshot-value" :class="stat.tone ? `tone-${stat.tone}` : ''">{{ stat.value }}</span>
    </div>
  </div>

  <DebtPayoffPlanner
    v-if="!showForm && debts.length && payoffPlan"
    :debts="debts"
    :plan="payoffPlan"
    @updated="payoffPlan = $event"
  />

  <div v-if="loaded && !debts.length && !showForm" class="empty-state">
    <h3>No debts yet</h3>
    <p>Add a debt to track its balance, interest rate, and minimum payment.</p>
    <button class="btn btn-primary" @click="openCreateForm">Add your first debt</button>
  </div>

  <ul v-else class="debt-list">
    <li v-for="debt in debts" :key="debt.id" class="card debt-row clickable" @click="openViewForm(debt)">
      <div>
        <div class="debt-name"><span class="debt-emoji" aria-hidden="true">💳</span>{{ debt.name }}</div>
        <div class="debt-meta">
          <span class="font-mono">{{ formatCurrency(debt.balance) }}</span> balance · {{ debt.interest_rate }}% APR · <span class="font-mono">{{ formatCurrency(debt.minimum_payment) }}</span>/mo due on the {{ debt.due_day }}
        </div>
      </div>
      <KebabMenu @click.stop>
        <button type="button" @click="openEditForm(debt)">Edit</button>
        <button type="button" class="danger" @click="requestDelete(debt)">Delete</button>
      </KebabMenu>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete debt?"
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

.snapshot-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.snapshot-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
}

.snapshot-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.snapshot-value {
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--color-text);
}

.snapshot-value.tone-danger {
  color: var(--color-danger);
}

.snapshot-value.tone-warning {
  color: var(--color-warning);
}

.snapshot-value.tone-success {
  color: var(--color-success);
}

.form-panel {
  margin-bottom: var(--space-5);
}

.form-panel h2 {
  margin-bottom: var(--space-4);
}

.debt-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.debt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
}

.debt-emoji {
  font-size: 1.05em;
  margin-right: var(--space-1);
}

.debt-row.clickable {
  cursor: pointer;
}

.debt-row.clickable:hover {
  border-color: var(--color-primary);
}

.debt-name {
  font-weight: 600;
}

.debt-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

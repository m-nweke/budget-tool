<script setup lang="ts">
import { api } from '../api';
import BillForm from '../components/BillForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useCrudListView } from '../composables/useCrudListView';
import { formatCurrency } from '../utils/format';
import type { Bill, CreateBillDto } from '../types';

const CATEGORY_LABELS: Record<Bill['category'], string> = {
  rent: 'Rent',
  wifi: 'WiFi',
  electric: 'Electric',
  water: 'Water',
  insurance: 'Insurance',
  other: 'Other',
};

const {
  items: bills,
  showForm,
  editingItem: editingBill,
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
} = useCrudListView<Bill, CreateBillDto>(
  () => api.getBills(),
  { create: api.createBill, update: api.updateBill, remove: api.deleteBill }
);
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Bills</h1>
      <p>Recurring monthly bills — rent, utilities, insurance — folded into your cash-flow simulation.</p>
    </div>
    <button v-if="!showForm && bills.length" class="btn btn-primary" @click="openCreateForm">+ Add Bill</button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ !editingBill ? 'New Bill' : formReadonly ? 'View Bill' : 'Edit Bill' }}</h2>
    <BillForm
      :bill="editingBill"
      :readonly="formReadonly"
      @submit="handleSubmit"
      @cancel="closeForm"
      @edit="formReadonly = false"
    />
  </div>

  <div v-if="loaded && !bills.length && !showForm" class="empty-state">
    <h3>No bills yet</h3>
    <p>Add your recurring bills so the cash-flow simulation accounts for them alongside your paychecks and debts.</p>
    <button class="btn btn-primary" @click="openCreateForm">Add your first bill</button>
  </div>

  <ul v-else class="bill-list">
    <li v-for="bill in bills" :key="bill.id" class="card bill-row clickable" @click="openViewForm(bill)">
      <div>
        <div class="bill-name">
          {{ bill.name }}
          <span class="badge badge-department">{{ CATEGORY_LABELS[bill.category] }}</span>
          <span v-if="!bill.active" class="badge badge-pending">Excluded</span>
        </div>
        <div class="bill-meta">{{ formatCurrency(bill.amount) }}/mo · due on the {{ bill.due_day }}</div>
      </div>
      <KebabMenu @click.stop>
        <button type="button" @click="openEditForm(bill)">Edit</button>
        <button type="button" class="danger" @click="requestDelete(bill)">Delete</button>
      </KebabMenu>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete bill?"
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

.bill-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.bill-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
}

.bill-row.clickable {
  cursor: pointer;
}

.bill-row.clickable:hover {
  border-color: var(--color-primary);
}

.bill-name {
  font-weight: 600;
}

.bill-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

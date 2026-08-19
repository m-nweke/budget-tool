<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';
import DebtForm from '../components/DebtForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import { formatCurrency } from '../utils/format';
import type { Debt, CreateDebtDto } from '../types';

const debts = ref<Debt[]>([]);
const showForm = ref(false);
const editingDebt = ref<Debt | null>(null);
const error = ref('');
const loaded = ref(false);
const viewTop = ref<HTMLElement | null>(null);

function scrollToForm() {
  viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadDebts() {
  debts.value = await api.getDebts();
  loaded.value = true;
}

function openCreateForm() {
  editingDebt.value = null;
  showForm.value = true;
  scrollToForm();
}

function openEditForm(debt: Debt) {
  editingDebt.value = debt;
  showForm.value = true;
  scrollToForm();
}

function closeForm() {
  showForm.value = false;
  editingDebt.value = null;
}

async function handleSubmit(data: CreateDebtDto) {
  error.value = '';
  try {
    if (editingDebt.value) {
      await api.updateDebt(editingDebt.value.id, data);
    } else {
      await api.createDebt(data);
    }
    closeForm();
    await loadDebts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleDelete(debt: Debt) {
  error.value = '';
  try {
    await api.deleteDebt(debt.id);
    await loadDebts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(loadDebts);
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
    <h2>{{ editingDebt ? 'Edit Debt' : 'New Debt' }}</h2>
    <DebtForm :debt="editingDebt" @submit="handleSubmit" @cancel="closeForm" />
  </div>

  <div v-if="loaded && !debts.length && !showForm" class="empty-state">
    <h3>No debts yet</h3>
    <p>Add a debt to track its balance, interest rate, and minimum payment.</p>
    <button class="btn btn-primary" @click="openCreateForm">Add your first debt</button>
  </div>

  <ul v-else class="debt-list">
    <li v-for="debt in debts" :key="debt.id" class="card debt-row">
      <div>
        <div class="debt-name">{{ debt.name }}</div>
        <div class="debt-meta">
          {{ formatCurrency(debt.balance) }} balance · {{ debt.interest_rate }}% APR · {{ formatCurrency(debt.minimum_payment) }}/mo due on the {{ debt.due_day }}
        </div>
      </div>
      <KebabMenu>
        <button type="button" @click="openEditForm(debt)">Edit</button>
        <button type="button" class="danger" @click="handleDelete(debt)">Delete</button>
      </KebabMenu>
    </li>
  </ul>
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
  padding: var(--space-4);
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

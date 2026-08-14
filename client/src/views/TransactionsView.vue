<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import TransactionForm from '../components/TransactionForm.vue';
import { formatCurrency } from '../format';
import type { Category, Transaction, NewTransaction } from '../types';

const transactions = ref<Transaction[]>([]);
const categories = ref<Category[]>([]);
const showForm = ref(false);
const editingTransaction = ref<Transaction | null>(null);
const error = ref('');
const loaded = ref(false);

const categoryNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const category of categories.value) {
    map[category.id] = category.name;
  }
  return map;
});

async function loadData() {
  [transactions.value, categories.value] = await Promise.all([
    api.getTransactions(),
    api.getCategories(),
  ]);
  loaded.value = true;
}

function openCreateForm() {
  editingTransaction.value = null;
  showForm.value = true;
}

function openEditForm(transaction: Transaction) {
  editingTransaction.value = transaction;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingTransaction.value = null;
}

async function handleSubmit(data: NewTransaction) {
  error.value = '';
  try {
    if (editingTransaction.value) {
      await api.updateTransaction(editingTransaction.value.id, data);
    } else {
      await api.createTransaction(data);
    }
    closeForm();
    await loadData();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleDelete(transaction: Transaction) {
  error.value = '';
  try {
    await api.deleteTransaction(transaction.id);
    await loadData();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(loadData);
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Transactions</h1>
      <p>Log spending against your categories.</p>
    </div>
    <button
      v-if="!showForm && loaded && categories.length"
      class="btn btn-primary"
      @click="openCreateForm"
    >
      + Add Transaction
    </button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="loaded && !categories.length" class="empty-state">
    <h3>Create a category first</h3>
    <p>Transactions need to belong to a category, so set one up before logging spending.</p>
    <RouterLink to="/categories" class="btn btn-primary">Go to Categories</RouterLink>
  </div>

  <template v-else>
    <div v-if="showForm" class="panel form-panel">
      <h2>{{ editingTransaction ? 'Edit Transaction' : 'New Transaction' }}</h2>
      <TransactionForm
        :transaction="editingTransaction"
        :categories="categories"
        @submit="handleSubmit"
        @cancel="closeForm"
      />
    </div>

    <div v-if="loaded && !transactions.length && !showForm" class="empty-state">
      <h3>No transactions yet</h3>
      <p>Log your first transaction to see it reflected on the dashboard.</p>
      <button class="btn btn-primary" @click="openCreateForm">Add your first transaction</button>
    </div>

    <div v-else class="card table-card">
      <table class="transactions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Category</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transaction in transactions" :key="transaction.id">
            <td>{{ transaction.date }}</td>
            <td>{{ transaction.description || '—' }}</td>
            <td class="amount-cell">{{ formatCurrency(transaction.amount) }}</td>
            <td>{{ categoryNameById[transaction.category_id] }}</td>
            <td class="row-actions">
              <button class="btn btn-secondary btn-sm" @click="openEditForm(transaction)">Edit</button>
              <button class="btn btn-danger btn-sm" @click="handleDelete(transaction)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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

.form-panel {
  margin-bottom: var(--space-5);
}

.form-panel h2 {
  margin-bottom: var(--space-4);
}

.table-card {
  overflow-x: auto;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.transactions-table th {
  text-align: left;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.transactions-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.transactions-table tbody tr:last-child td {
  border-bottom: none;
}

.transactions-table tbody tr:hover {
  background: var(--color-bg);
}

.amount-cell {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.row-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}
</style>

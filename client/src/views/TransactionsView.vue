<script setup>
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import TransactionForm from '../components/TransactionForm.vue';

const transactions = ref([]);
const categories = ref([]);
const showForm = ref(false);
const editingTransaction = ref(null);
const error = ref('');

const categoryNameById = computed(() => {
  const map = {};
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
}

function openCreateForm() {
  editingTransaction.value = null;
  showForm.value = true;
}

function openEditForm(transaction) {
  editingTransaction.value = transaction;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingTransaction.value = null;
}

async function handleSubmit(data) {
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
    error.value = e.message;
  }
}

async function handleDelete(transaction) {
  error.value = '';
  try {
    await api.deleteTransaction(transaction.id);
    await loadData();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(loadData);
</script>

<template>
  <h1>Transactions</h1>
  <p v-if="error" class="error">{{ error }}</p>

  <button v-if="!showForm" @click="openCreateForm">Add Transaction</button>

  <TransactionForm
    v-if="showForm"
    :transaction="editingTransaction"
    :categories="categories"
    @submit="handleSubmit"
    @cancel="closeForm"
  />

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
        <td>{{ transaction.description }}</td>
        <td>${{ transaction.amount.toFixed(2) }}</td>
        <td>{{ categoryNameById[transaction.category_id] }}</td>
        <td class="row-actions">
          <button @click="openEditForm(transaction)">Edit</button>
          <button @click="handleDelete(transaction)">Delete</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.error {
  color: #b91c1c;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.transactions-table th,
.transactions-table td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

.row-actions {
  display: flex;
  gap: 0.5rem;
}
</style>

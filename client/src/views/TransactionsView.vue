<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import { useAuth } from '../composables/useAuth';
import TransactionForm from '../components/TransactionForm.vue';
import RecurringTransactionForm from '../components/RecurringTransactionForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import { formatCurrency } from '../utils/format';
import type {
  Category,
  Transaction,
  CreateTransactionDto,
  RecurringTransaction,
  UpdateRecurringTransactionDto,
  RecurrenceInterval,
  Department,
} from '../types';

const { canManageBudget } = useAuth();
const transactions = ref<Transaction[]>([]);
const categories = ref<Category[]>([]);
const recurringTransactions = ref<RecurringTransaction[]>([]);
const departments = ref<Department[]>([]);
const showForm = ref(false);
const editingTransaction = ref<Transaction | null>(null);
const showRecurringForm = ref(false);
const editingRecurringTransaction = ref<RecurringTransaction | null>(null);
const error = ref('');
const loaded = ref(false);
const viewTop = ref<HTMLElement | null>(null);
const categoryFilter = ref<number | ''>('');

function scrollToForm() {
  viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// A generated occurrence is only "locked" to its series (edit/delete routed
// through the template instead) while that series is still active. Once the
// series is cancelled or has run past its end date, GET /recurring-transactions
// no longer returns it, so relying on `!transaction.recurring_transaction_id`
// alone would leave these rows permanently stuck with no way to edit or
// delete them directly.
function isLockedToActiveSeries(transaction: Transaction): boolean {
  if (!transaction.recurring_transaction_id) return false;
  return recurringTransactions.value.some((rt) => rt.id === transaction.recurring_transaction_id);
}

const categoryNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const category of categories.value) {
    map[category.id] = category.name;
  }
  return map;
});

// Only worth labeling by department when a head has access to more than
// one — an employee (always exactly one department) or a head scoped to a
// single one gets no extra information from the label.
const showDepartmentLabel = computed(() => departments.value.length > 1);
const departmentNameByCategoryId = computed(() => {
  const departmentNames: Record<number, string> = {};
  for (const department of departments.value) {
    departmentNames[department.id] = department.name;
  }
  const map: Record<number, string> = {};
  for (const category of categories.value) {
    if (category.department_id !== null) {
      map[category.id] = departmentNames[category.department_id];
    }
  }
  return map;
});

const filteredTransactions = computed(() => {
  if (!categoryFilter.value) return transactions.value;
  return transactions.value.filter((t) => t.category_id === categoryFilter.value);
});

let filterInitialized = false;

async function loadData() {
  [transactions.value, categories.value, recurringTransactions.value, departments.value] = await Promise.all([
    api.getTransactions(),
    api.getCategories(),
    api.getRecurringTransactions(),
    api.getDepartments(),
  ]);
  loaded.value = true;

  // Auto-select the only category so the filter is immediately useful with
  // one category; leave it on "all" once there's a real choice to make.
  // Only on first load — later reloads (after create/edit/delete) shouldn't
  // override a filter the user has since chosen for themselves.
  if (!filterInitialized) {
    filterInitialized = true;
    categoryFilter.value = categories.value.length === 1 ? categories.value[0].id : '';
  }
}

function openCreateForm() {
  editingTransaction.value = null;
  showForm.value = true;
  scrollToForm();
}

function openEditForm(transaction: Transaction) {
  // A generated occurrence has no independent identity worth editing —
  // editing always targets the recurring template (affects future
  // occurrences), never the single spawned row.
  if (transaction.recurring_transaction_id) {
    const template = recurringTransactions.value.find(
      (rt) => rt.id === transaction.recurring_transaction_id
    );
    if (template) {
      openEditRecurringForm(template);
      return;
    }
  }
  editingTransaction.value = transaction;
  showForm.value = true;
  scrollToForm();
}

function openEditRecurringForm(recurringTransaction: RecurringTransaction) {
  editingRecurringTransaction.value = recurringTransaction;
  showRecurringForm.value = true;
  scrollToForm();
}

function closeForm() {
  showForm.value = false;
  editingTransaction.value = null;
  showRecurringForm.value = false;
  editingRecurringTransaction.value = null;
}

async function handleSubmit(
  data: CreateTransactionDto,
  recurrence: { recurring: boolean; interval: RecurrenceInterval; end_date: string | null }
) {
  error.value = '';
  try {
    if (editingTransaction.value) {
      await api.updateTransaction(editingTransaction.value.id, data);
    } else if (recurrence.recurring) {
      await api.createRecurringTransaction({
        amount: data.amount,
        description: data.description,
        category_id: data.category_id,
        start_date: data.date,
        interval: recurrence.interval,
        end_date: recurrence.end_date,
      });
    } else {
      await api.createTransaction(data);
    }
    closeForm();
    await loadData();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleRecurringSubmit(data: UpdateRecurringTransactionDto) {
  error.value = '';
  try {
    await api.updateRecurringTransaction(editingRecurringTransaction.value!.id, data);
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

async function handleCancelRecurring(recurringTransaction: RecurringTransaction) {
  error.value = '';
  try {
    await api.deleteRecurringTransaction(recurringTransaction.id);
    await loadData();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(loadData);
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Transactions</h1>
      <p>Log spending against your categories.</p>
    </div>
    <button
      v-if="!showForm && !showRecurringForm && loaded && categories.length"
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

    <div v-if="showRecurringForm && editingRecurringTransaction" class="panel form-panel">
      <h2>Edit Recurring Series</h2>
      <RecurringTransactionForm
        :recurring-transaction="editingRecurringTransaction"
        :categories="categories"
        @submit="handleRecurringSubmit"
        @cancel="closeForm"
      />
    </div>

    <div v-if="loaded && !transactions.length && !showForm" class="empty-state">
      <h3>No transactions yet</h3>
      <p>Log your first transaction to see it reflected on the dashboard.</p>
      <button class="btn btn-primary" @click="openCreateForm">Add your first transaction</button>
    </div>

    <template v-else>
      <div class="filter-bar">
        <label class="field filter-field">
          Filter by category
          <select v-model="categoryFilter">
            <option value="">All categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="!filteredTransactions.length" class="empty-state">
        <h3>No transactions in this category</h3>
        <p>Try a different category, or clear the filter to see everything.</p>
        <button class="btn btn-secondary" @click="categoryFilter = ''">Clear filter</button>
      </div>

      <div v-else class="card table-card">
        <table class="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Category</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transaction in filteredTransactions" :key="transaction.id">
              <td>{{ transaction.date }}</td>
              <td>
                {{ transaction.description || '—' }}
                <span v-if="transaction.recurring_transaction_id" class="badge badge-recurring">↻ Recurring</span>
                <span v-if="transaction.needs_approval" class="badge badge-pending">Pending approval</span>
              </td>
              <td class="amount-cell">{{ formatCurrency(transaction.amount) }}</td>
              <td>
                {{ categoryNameById[transaction.category_id] }}
                <span v-if="showDepartmentLabel" class="badge badge-department">
                  {{ departmentNameByCategoryId[transaction.category_id] }}
                </span>
              </td>
              <td class="table-row-actions">
                <KebabMenu v-if="!isLockedToActiveSeries(transaction)">
                  <button type="button" @click="openEditForm(transaction)">Edit</button>
                  <button v-if="canManageBudget" type="button" class="danger" @click="handleDelete(transaction)">Delete</button>
                </KebabMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="recurringTransactions.length" class="recurring-section">
      <h2>Recurring</h2>
      <ul class="recurring-list">
        <li v-for="rt in recurringTransactions" :key="rt.id" class="card recurring-row">
          <div>
            <div class="recurring-description">{{ rt.description || categoryNameById[rt.category_id] }}</div>
            <div class="recurring-meta">
              {{ formatCurrency(rt.amount) }} · {{ rt.interval }} · next on {{ rt.next_run_date }}
              <template v-if="rt.end_date">· ends {{ rt.end_date }}</template>
            </div>
          </div>
          <KebabMenu>
            <button type="button" @click="openEditRecurringForm(rt)">Edit</button>
            <button type="button" class="danger" @click="handleCancelRecurring(rt)">Cancel</button>
          </KebabMenu>
        </li>
      </ul>
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

.filter-bar {
  margin-bottom: var(--space-4);
}

.filter-field {
  max-width: 240px;
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

.actions-col {
  width: 56px;
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

.table-row-actions {
  text-align: right;
}

.recurring-section {
  margin-top: var(--space-6);
}

.recurring-section h2 {
  margin-bottom: var(--space-3);
}

.recurring-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recurring-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
}

.recurring-description {
  font-weight: 500;
  font-size: 0.9rem;
}

.recurring-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

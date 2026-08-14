<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { api } from '../api';
import type { Category, Transaction, RecurringTransaction, Interval } from '../types';
import { formatCurrency } from '../utils/currency';
import KebabMenu from '../components/KebabMenu.vue';
import TransactionForm from '../components/TransactionForm.vue';
import RecurringForm from '../components/RecurringForm.vue';

const categories = ref<Category[]>([]);
const transactions = ref<Transaction[]>([]);
const recurring = ref<RecurringTransaction[]>([]);
const loaded = ref(false);
const error = ref('');

const categoryFilter = ref<number | null>(null);

const showTxForm = ref(false);
const editingTx = ref<Transaction | null>(null);
const txFormAnchor = ref<HTMLElement | null>(null);

const showRecurringForm = ref(false);
const editingRecurring = ref<RecurringTransaction | null>(null);
const recurringFormAnchor = ref<HTMLElement | null>(null);

const filteredTransactions = computed(() => {
  if (categoryFilter.value === null) return transactions.value;
  return transactions.value.filter((t) => t.category_id === categoryFilter.value);
});

function categoryName(id: number): string {
  return categories.value.find((c) => c.id === id)?.name ?? 'Unknown';
}

function activeRecurringSeries(t: Transaction): RecurringTransaction | undefined {
  if (t.recurring_transaction_id === null) return undefined;
  return recurring.value.find((r) => r.id === t.recurring_transaction_id && r.active === 1);
}

async function load() {
  const [c, t, r] = await Promise.all([api.getCategories(), api.getTransactions(), api.getRecurringTransactions()]);
  categories.value = c;
  transactions.value = t;
  recurring.value = r;
  if (c.length === 1) categoryFilter.value = c[0].id;
  loaded.value = true;
}

async function openCreateTx() {
  editingTx.value = null;
  showTxForm.value = true;
  await nextTick();
  txFormAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openEditTx(t: Transaction) {
  editingTx.value = t;
  showTxForm.value = true;
  await nextTick();
  txFormAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onSubmitTx(payload: {
  amount: number;
  date: string;
  description: string;
  category_id: number;
  repeat: boolean;
  interval: Interval;
  end_date: string;
}) {
  error.value = '';
  try {
    if (editingTx.value) {
      await api.updateTransaction(editingTx.value.id, {
        amount: payload.amount,
        date: payload.date,
        description: payload.description,
        category_id: payload.category_id,
      });
    } else if (payload.repeat) {
      await api.createRecurringTransaction({
        amount: payload.amount,
        description: payload.description,
        category_id: payload.category_id,
        interval: payload.interval,
        start_date: payload.date,
        end_date: payload.end_date || undefined,
      });
    } else {
      await api.createTransaction({
        amount: payload.amount,
        date: payload.date,
        description: payload.description,
        category_id: payload.category_id,
      });
    }
    showTxForm.value = false;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function onDeleteTx(t: Transaction) {
  error.value = '';
  try {
    await api.deleteTransaction(t.id);
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function openEditRecurring(r: RecurringTransaction) {
  editingRecurring.value = r;
  showRecurringForm.value = true;
  await nextTick();
  recurringFormAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onSubmitRecurring(payload: {
  amount: number;
  description: string;
  category_id: number;
  interval: Interval;
  end_date: string;
  apply_to_existing: boolean;
}) {
  error.value = '';
  try {
    if (!editingRecurring.value) return;
    await api.updateRecurringTransaction(editingRecurring.value.id, {
      amount: payload.amount,
      description: payload.description,
      category_id: payload.category_id,
      interval: payload.interval,
      end_date: payload.end_date || undefined,
      apply_to_existing: payload.apply_to_existing,
    });
    showRecurringForm.value = false;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function onCancelRecurring(r: RecurringTransaction) {
  error.value = '';
  try {
    await api.deleteRecurringTransaction(r.id);
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(load);
</script>

<template>
  <div class="page-header">
    <h1>Transactions</h1>
    <button v-if="categories.length > 0" class="primary" @click="openCreateTx">New Transaction</button>
  </div>

  <p v-if="error" class="tier-red">{{ error }}</p>

  <div v-if="loaded && categories.length === 0" class="empty-state">
    Create a category first before adding transactions.
  </div>

  <template v-else-if="loaded">
    <div class="filter-bar">
      <label>
        Category
        <select v-model.number="categoryFilter">
          <option :value="null">All categories</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
    </div>

    <div ref="txFormAnchor">
      <TransactionForm
        v-if="showTxForm"
        :transaction="editingTx"
        :categories="categories"
        @submit="onSubmitTx"
        @cancel="showTxForm = false"
      />
    </div>

    <div v-if="filteredTransactions.length === 0" class="empty-state">
      <template v-if="transactions.length === 0">No transactions yet. Create the first one above.</template>
      <template v-else>No transactions match this category filter.</template>
    </div>

    <table v-else>
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Description</th>
          <th>Amount</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in filteredTransactions" :key="t.id">
          <td>{{ t.date }}</td>
          <td>{{ categoryName(t.category_id) }}</td>
          <td>{{ t.description }}</td>
          <td>{{ formatCurrency(t.amount) }}</td>
          <td class="actions-col">
            <KebabMenu v-if="!activeRecurringSeries(t)">
              <button @click="openEditTx(t)">Edit</button>
              <button class="danger" @click="onDeleteTx(t)">Delete</button>
            </KebabMenu>
          </td>
        </tr>
      </tbody>
    </table>

    <h2>Recurring</h2>
    <div ref="recurringFormAnchor">
      <RecurringForm
        v-if="showRecurringForm"
        :recurring="editingRecurring"
        :categories="categories"
        @submit="onSubmitRecurring"
        @cancel="showRecurringForm = false"
      />
    </div>

    <div v-if="recurring.length === 0" class="empty-state">No recurring series yet.</div>

    <table v-else>
      <thead>
        <tr>
          <th>Category</th>
          <th>Description</th>
          <th>Amount</th>
          <th>Interval</th>
          <th>Status</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in recurring" :key="r.id">
          <td>{{ categoryName(r.category_id) }}</td>
          <td>{{ r.description }}</td>
          <td>{{ formatCurrency(r.amount) }}</td>
          <td>{{ r.interval }}</td>
          <td>{{ r.active ? 'Active' : 'Cancelled' }}</td>
          <td class="actions-col">
            <KebabMenu>
              <button v-if="r.active" @click="openEditRecurring(r)">Edit</button>
              <button v-if="r.active" class="danger" @click="onCancelRecurring(r)">Cancel Series</button>
            </KebabMenu>
          </td>
        </tr>
      </tbody>
    </table>
  </template>
</template>

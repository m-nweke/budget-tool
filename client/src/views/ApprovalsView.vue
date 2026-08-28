<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import { usePendingApprovals } from '../composables/usePendingApprovals';
import { formatCurrency } from '../utils/format';
import { emojiForLabel } from '../utils/categoryEmoji';
import type { Category, Transaction } from '../types';

const { pending, refresh } = usePendingApprovals();
const categories = ref<Category[]>([]);
const error = ref('');
const loaded = ref(false);
// Tracks the id currently being approved/rejected so only that row's
// buttons disable — a slow request for one transaction shouldn't freeze
// the whole list.
const actingOnId = ref<number | null>(null);

const categoryNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const category of categories.value) {
    map[category.id] = category.name;
  }
  return map;
});

async function loadData() {
  [categories.value] = await Promise.all([api.getCategories(), refresh()]);
  loaded.value = true;
}

async function handleApprove(transaction: Transaction) {
  error.value = '';
  actingOnId.value = transaction.id;
  try {
    await api.approveTransaction(transaction.id);
    await refresh();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    actingOnId.value = null;
  }
}

async function handleReject(transaction: Transaction) {
  error.value = '';
  actingOnId.value = transaction.id;
  try {
    await api.rejectTransaction(transaction.id);
    await refresh();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    actingOnId.value = null;
  }
}

onMounted(loadData);
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Approvals</h1>
      <p>Transactions over their category's approval threshold, waiting on you.</p>
    </div>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="loaded && !pending.length" class="empty-state">
    <h3>Nothing pending</h3>
    <p>Every transaction in your departments is within its category's threshold, or already decided.</p>
  </div>

  <div v-else-if="loaded" class="card table-card">
    <table class="approvals-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Amount</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="transaction in pending" :key="transaction.id">
          <td>{{ transaction.date }}</td>
          <td>{{ transaction.description || '—' }}</td>
          <td>
            <span class="category-emoji" aria-hidden="true">{{ emojiForLabel(categoryNameById[transaction.category_id] ?? '') }}</span>
            {{ categoryNameById[transaction.category_id] }}
          </td>
          <td class="amount-cell font-mono">{{ formatCurrency(transaction.amount) }}</td>
          <td class="table-row-actions">
            <div class="action-buttons">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="actingOnId === transaction.id"
                @click="handleApprove(transaction)"
              >
                Approve
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                :disabled="actingOnId === transaction.id"
                @click="handleReject(transaction)"
              >
                Reject
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.view-header {
  margin-bottom: var(--space-5);
}

.view-header p {
  margin-top: var(--space-1);
}

.table-card {
  overflow-x: auto;
  border-radius: var(--radius-lg);
}

.category-emoji {
  font-size: 1.05em;
  margin-right: 2px;
}

.approvals-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.approvals-table th {
  text-align: left;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.actions-col {
  width: 160px;
}

.approvals-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.approvals-table tbody tr:last-child td {
  border-bottom: none;
}

.amount-cell {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.table-row-actions {
  text-align: right;
}

.action-buttons {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}
</style>

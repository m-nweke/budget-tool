<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import PaycheckForm from '../components/PaycheckForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import { formatCurrency } from '../utils/format';
import type { Paycheck, CreatePaycheckDto, BankAccount } from '../types';

const paychecks = ref<Paycheck[]>([]);
const accounts = ref<BankAccount[]>([]);
const showForm = ref(false);
const editingPaycheck = ref<Paycheck | null>(null);
const error = ref('');
const loaded = ref(false);
const viewTop = ref<HTMLElement | null>(null);

const accountNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const account of accounts.value) {
    map[account.id] = account.name;
  }
  return map;
});

function scrollToForm() {
  viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadPaychecks() {
  [paychecks.value, accounts.value] = await Promise.all([api.getPaychecks(), api.getBankAccounts()]);
  loaded.value = true;
}

function openCreateForm() {
  editingPaycheck.value = null;
  showForm.value = true;
  scrollToForm();
}

function openEditForm(paycheck: Paycheck) {
  editingPaycheck.value = paycheck;
  showForm.value = true;
  scrollToForm();
}

function closeForm() {
  showForm.value = false;
  editingPaycheck.value = null;
}

async function handleSubmit(data: CreatePaycheckDto) {
  error.value = '';
  try {
    if (editingPaycheck.value) {
      await api.updatePaycheck(editingPaycheck.value.id, data);
    } else {
      await api.createPaycheck(data);
    }
    closeForm();
    await loadPaychecks();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleDelete(paycheck: Paycheck) {
  error.value = '';
  try {
    await api.deletePaycheck(paycheck.id);
    await loadPaychecks();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function formatSplit(split: Paycheck['splits'][number]): string {
  const amount = split.split_type === 'percentage' ? `${split.value}%` : formatCurrency(split.value);
  return `${amount} → ${accountNameById.value[split.bank_account_id] ?? 'Unknown account'}`;
}

onMounted(loadPaychecks);
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
    <h2>{{ editingPaycheck ? 'Edit Paycheck' : 'New Paycheck' }}</h2>
    <PaycheckForm :paycheck="editingPaycheck" @submit="handleSubmit" @cancel="closeForm" />
  </div>

  <div v-if="loaded && !paychecks.length && !showForm" class="empty-state">
    <h3>No paychecks yet</h3>
    <p>Schedule a paycheck to plan how it splits across your accounts.</p>
    <button class="btn btn-primary" @click="openCreateForm">Create your first paycheck</button>
  </div>

  <ul v-else class="paycheck-list">
    <li v-for="paycheck in paychecks" :key="paycheck.id" class="card paycheck-row">
      <div>
        <div class="paycheck-name">
          {{ paycheck.label }}
          <span class="badge badge-department">{{ paycheck.frequency }}</span>
        </div>
        <div class="paycheck-meta">
          {{ formatCurrency(paycheck.amount) }} next on {{ paycheck.next_pay_date }}
        </div>
        <ul v-if="paycheck.splits.length" class="split-list">
          <li v-for="split in paycheck.splits" :key="split.id">{{ formatSplit(split) }}</li>
        </ul>
      </div>
      <KebabMenu>
        <button type="button" @click="openEditForm(paycheck)">Edit</button>
        <button type="button" class="danger" @click="handleDelete(paycheck)">Delete</button>
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
</style>

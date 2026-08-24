<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';
import AccountForm from '../components/AccountForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import { formatCurrency } from '../utils/format';
import type { BankAccount, CreateBankAccountDto } from '../types';

const accounts = ref<BankAccount[]>([]);
const showForm = ref(false);
const editingAccount = ref<BankAccount | null>(null);
const error = ref('');
const loaded = ref(false);
const viewTop = ref<HTMLElement | null>(null);

function scrollToForm() {
  viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadAccounts() {
  accounts.value = await api.getBankAccounts();
  loaded.value = true;
}

function openCreateForm() {
  editingAccount.value = null;
  showForm.value = true;
  scrollToForm();
}

function openEditForm(account: BankAccount) {
  editingAccount.value = account;
  showForm.value = true;
  scrollToForm();
}

function closeForm() {
  showForm.value = false;
  editingAccount.value = null;
}

async function handleSubmit(data: CreateBankAccountDto) {
  error.value = '';
  try {
    if (editingAccount.value) {
      await api.updateBankAccount(editingAccount.value.id, data);
    } else {
      await api.createBankAccount(data);
    }
    closeForm();
    await loadAccounts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleDelete(account: BankAccount) {
  error.value = '';
  try {
    await api.deleteBankAccount(account.id);
    await loadAccounts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(loadAccounts);
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Accounts</h1>
      <p>Track the balance of each bank account.</p>
    </div>
    <button v-if="!showForm && accounts.length" class="btn btn-primary" @click="openCreateForm">+ Add Account</button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ editingAccount ? 'Edit Account' : 'New Account' }}</h2>
    <AccountForm :account="editingAccount" @submit="handleSubmit" @cancel="closeForm" />
  </div>

  <div v-if="loaded && !accounts.length && !showForm" class="empty-state">
    <h3>No accounts yet</h3>
    <p>Add a bank account to start tracking its balance and splitting paychecks into it.</p>
    <button class="btn btn-primary" @click="openCreateForm">Create your first account</button>
  </div>

  <ul v-else class="account-list">
    <li v-for="account in accounts" :key="account.id" class="card account-row">
      <div>
        <div class="account-name">
          {{ account.name }}
          <span class="badge badge-department">{{ account.type }}</span>
          <span v-if="account.apy" class="badge badge-recurring">{{ account.apy }}% APY</span>
        </div>
        <div class="account-balance">{{ formatCurrency(account.current_balance) }}</div>
      </div>
      <KebabMenu>
        <button type="button" @click="openEditForm(account)">Edit</button>
        <button type="button" class="danger" @click="handleDelete(account)">Delete</button>
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

.account-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
}

.account-name {
  font-weight: 600;
}

.account-balance {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

<script setup lang="ts">
import { api } from '../api';
import AccountForm from '../components/AccountForm.vue';
import BankLogo from '../components/BankLogo.vue';
import KebabMenu from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useCrudListView } from '../composables/useCrudListView';
import { formatCurrency, capitalize } from '../utils/format';
import type { BankAccount, CreateBankAccountDto } from '../types';

const ACCOUNT_TYPE_EMOJI: Record<string, string> = {
  checking: '🏦',
  savings: '🐖',
  other: '💳',
};

const {
  items: accounts,
  showForm,
  editingItem: editingAccount,
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
} = useCrudListView<BankAccount, CreateBankAccountDto>(
  () => api.getBankAccounts(),
  { create: api.createBankAccount, update: api.updateBankAccount, remove: api.deleteBankAccount }
);
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
    <h2>{{ !editingAccount ? 'New Account' : formReadonly ? 'View Account' : 'Edit Account' }}</h2>
    <AccountForm
      :account="editingAccount"
      :readonly="formReadonly"
      @submit="handleSubmit"
      @cancel="closeForm"
      @edit="formReadonly = false"
    />
  </div>

  <div v-if="loaded && !accounts.length && !showForm" class="empty-state">
    <h3>No accounts yet</h3>
    <p>Add a bank account to start tracking its balance and splitting paychecks into it.</p>
    <button class="btn btn-primary" @click="openCreateForm">Create your first account</button>
  </div>

  <ul v-else class="account-list">
    <li v-for="account in accounts" :key="account.id" class="card account-row clickable" @click="openViewForm(account)">
      <div>
        <div class="account-name">
          <BankLogo v-if="account.institution" :institution="account.institution" size="2.25rem" shape="squircle" />
          <span v-else class="account-emoji" aria-hidden="true">{{ ACCOUNT_TYPE_EMOJI[account.type] ?? '🏦' }}</span>
          {{ account.name }}
          <span class="badge badge-department">{{ capitalize(account.type) }}</span>
          <span v-if="account.apy != null" class="badge badge-accent">{{ account.apy }}% APY</span>
        </div>
        <div class="account-balance font-mono">{{ formatCurrency(account.current_balance) }}</div>
      </div>
      <KebabMenu @click.stop>
        <button type="button" @click="openEditForm(account)">Edit</button>
        <button type="button" class="danger" @click="requestDelete(account)">Delete</button>
      </KebabMenu>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete account?"
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
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
}

.account-emoji {
  font-size: 1.05em;
}

.account-row.clickable {
  cursor: pointer;
}

.account-row.clickable:hover {
  border-color: var(--color-primary);
}

.account-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.account-balance {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

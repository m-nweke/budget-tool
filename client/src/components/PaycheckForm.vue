<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { api } from '../api';
import type {
  Paycheck,
  CreatePaycheckDto,
  CreatePaycheckSplitDto,
  PaycheckFrequency,
  BankAccount,
  BankAccountType,
} from '../types';

const props = defineProps<{
  paycheck: Paycheck | null;
}>();
const emit = defineEmits<{
  submit: [data: CreatePaycheckDto];
  cancel: [];
}>();

const label = ref('');
const amount = ref<number | string>('');
const frequency = ref<PaycheckFrequency>('biweekly');
const nextPayDate = ref(new Date().toISOString().slice(0, 10));
const splits = ref<CreatePaycheckSplitDto[]>([]);
const accounts = ref<BankAccount[]>([]);

watch(
  () => props.paycheck,
  (paycheck) => {
    label.value = paycheck ? paycheck.label : '';
    amount.value = paycheck ? paycheck.amount : '';
    frequency.value = paycheck ? paycheck.frequency : 'biweekly';
    nextPayDate.value = paycheck ? paycheck.next_pay_date : new Date().toISOString().slice(0, 10);
    // Splits have no independent lifecycle of their own (see
    // paycheckRepository) — the form just edits a local copy of the array
    // and submits it wholesale, same as the server replaces it wholesale.
    splits.value = paycheck ? paycheck.splits.map(({ bank_account_id, split_type, value }) => ({ bank_account_id, split_type, value })) : [];
  },
  { immediate: true }
);

onMounted(async () => {
  accounts.value = await api.getBankAccounts();
  if (!props.paycheck && accounts.value.length && !splits.value.length) {
    addSplit();
  }
});

function addSplit() {
  splits.value.push({ bank_account_id: accounts.value[0]?.id ?? 0, split_type: 'percentage', value: 0 });
}

function removeSplit(index: number) {
  splits.value.splice(index, 1);
}

// Splitting requires an account to split into, but sending someone all the
// way to /accounts and back to add their first one (and then having to
// re-open this form) was the friction behind "why can't I add a split" —
// this quick-create form lets them create one inline instead, without
// leaving the paycheck form.
const showQuickAccount = ref(false);
const quickAccountName = ref('');
const quickAccountType = ref<BankAccountType>('checking');
const quickAccountError = ref('');
const creatingQuickAccount = ref(false);

async function handleQuickAddAccount() {
  quickAccountError.value = '';
  creatingQuickAccount.value = true;
  try {
    const account = await api.createBankAccount({ name: quickAccountName.value, type: quickAccountType.value });
    accounts.value.push(account);
    quickAccountName.value = '';
    quickAccountType.value = 'checking';
    showQuickAccount.value = false;
    addSplit();
  } catch (e) {
    quickAccountError.value = (e as Error).message;
  } finally {
    creatingQuickAccount.value = false;
  }
}

function handleSubmit() {
  emit('submit', {
    label: label.value,
    amount: Number(amount.value),
    frequency: frequency.value,
    next_pay_date: nextPayDate.value,
    splits: splits.value.map((split) => ({ ...split, value: Number(split.value) })),
  });
}
</script>

<template>
  <form class="paycheck-form" @submit.prevent="handleSubmit">
    <label class="field">
      Label
      <input v-model="label" type="text" placeholder="e.g. Paycheck" required />
    </label>
    <label class="field">
      Amount
      <input v-model="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <label class="field">
      Frequency
      <select v-model="frequency" required>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="semimonthly">Semimonthly</option>
        <option value="monthly">Monthly</option>
      </select>
    </label>
    <label class="field">
      Next Pay Date
      <input v-model="nextPayDate" type="date" required />
    </label>

    <div class="splits-section">
      <div class="splits-header">
        <span>Splits (optional)</span>
        <button type="button" class="btn btn-secondary btn-sm" :disabled="!accounts.length" @click="addSplit">
          + Add Split
        </button>
      </div>
      <template v-if="!accounts.length">
        <p class="field-hint">You'll need a bank account before you can split this paycheck across one.</p>
        <button
          v-if="!showQuickAccount"
          type="button"
          class="btn btn-secondary btn-sm quick-account-toggle"
          @click="showQuickAccount = true"
        >
          + Add an account now
        </button>
        <div v-else class="quick-account-form">
          <p v-if="quickAccountError" class="alert">{{ quickAccountError }}</p>
          <div class="quick-account-row">
            <input v-model="quickAccountName" type="text" placeholder="e.g. Checking" />
            <select v-model="quickAccountType">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="other">Other</option>
            </select>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!quickAccountName || creatingQuickAccount"
              @click="handleQuickAddAccount"
            >
              Create
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="showQuickAccount = false">Cancel</button>
          </div>
        </div>
      </template>
      <p v-else class="field-hint">
        Each split is a percentage of the paycheck or a fixed dollar amount. Splits don't need to add up to the full amount.
      </p>
      <div v-for="(split, index) in splits" :key="index" class="split-row">
        <select v-model="split.bank_account_id">
          <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
        </select>
        <select v-model="split.split_type">
          <option value="percentage">%</option>
          <option value="fixed">$</option>
        </select>
        <input v-model="split.value" type="number" step="0.01" min="0" placeholder="0" />
        <button type="button" class="btn btn-secondary btn-sm" @click="removeSplit(index)">Remove</button>
      </div>
    </div>

    <div class="actions">
      <button type="submit" class="btn btn-primary">{{ paycheck ? 'Save Changes' : 'Create Paycheck' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.paycheck-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 480px;
}

.field-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: calc(var(--space-2) * -1);
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.splits-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.splits-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 0.9rem;
}

.split-row {
  display: grid;
  grid-template-columns: 1fr 70px 100px auto;
  gap: var(--space-2);
  align-items: center;
}

.quick-account-toggle {
  align-self: flex-start;
}

.quick-account-form {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}

.quick-account-row {
  display: grid;
  grid-template-columns: 1fr 110px auto auto;
  gap: var(--space-2);
  align-items: center;
}
</style>

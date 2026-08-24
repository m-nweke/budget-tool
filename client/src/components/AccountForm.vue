<script setup lang="ts">
import { ref, watch } from 'vue';
import type { BankAccount, BankAccountType, CreateBankAccountDto } from '../types';

const props = defineProps<{
  account: BankAccount | null;
}>();
const emit = defineEmits<{
  submit: [data: CreateBankAccountDto];
  cancel: [];
}>();

const name = ref('');
const type = ref<BankAccountType>('checking');
const currentBalance = ref<number | string>('');
const apy = ref<number | string>('');

watch(
  () => props.account,
  (account) => {
    name.value = account ? account.name : '';
    type.value = account ? account.type : 'checking';
    currentBalance.value = account ? account.current_balance : '';
    apy.value = account?.apy ?? '';
  },
  { immediate: true }
);

function handleSubmit() {
  emit('submit', {
    name: name.value,
    type: type.value,
    current_balance: currentBalance.value === '' ? undefined : Number(currentBalance.value),
    apy: apy.value === '' ? null : Number(apy.value),
  });
}
</script>

<template>
  <form class="account-form" @submit.prevent="handleSubmit">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Checking" required />
    </label>
    <label class="field">
      Type
      <select v-model="type" required>
        <option value="checking">Checking</option>
        <option value="savings">Savings</option>
        <option value="other">Other</option>
      </select>
    </label>
    <label class="field">
      Current Balance
      <input v-model="currentBalance" type="number" step="0.01" placeholder="0.00" />
    </label>
    <label v-if="type === 'savings'" class="field">
      APY % (optional)
      <input v-model="apy" type="number" step="0.01" min="0" max="100" placeholder="e.g. 4.50" />
    </label>
    <div class="actions">
      <button type="submit" class="btn btn-primary">{{ account ? 'Save Changes' : 'Create Account' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.account-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 360px;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

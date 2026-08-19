<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { api } from '../api';
import type { SavingsGoal, CreateSavingsGoalDto, BankAccount } from '../types';

const props = defineProps<{
  goal: SavingsGoal | null;
}>();
const emit = defineEmits<{
  submit: [data: CreateSavingsGoalDto];
  cancel: [];
}>();

const name = ref('');
const targetAmount = ref<number | string>('');
const startOn = ref(new Date().toISOString().slice(0, 10));
const targetDate = ref('');
const bankAccountId = ref<number | ''>('');
const accounts = ref<BankAccount[]>([]);

watch(
  () => props.goal,
  (goal) => {
    name.value = goal ? goal.name : '';
    targetAmount.value = goal ? goal.target_amount : '';
    startOn.value = goal ? goal.start_on : new Date().toISOString().slice(0, 10);
    targetDate.value = goal?.target_date ?? '';
    bankAccountId.value = goal?.bank_account_id ?? '';
  },
  { immediate: true }
);

onMounted(async () => {
  accounts.value = await api.getBankAccounts();
});

function handleSubmit() {
  emit('submit', {
    name: name.value,
    target_amount: Number(targetAmount.value),
    start_on: startOn.value,
    target_date: targetDate.value === '' ? null : targetDate.value,
    bank_account_id: bankAccountId.value === '' ? null : bankAccountId.value,
  });
}
</script>

<template>
  <form class="goal-form" @submit.prevent="handleSubmit">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Emergency Fund" required />
    </label>
    <label class="field">
      Target Amount
      <input v-model="targetAmount" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <label v-if="accounts.length" class="field">
      Linked Account (optional)
      <select v-model="bankAccountId">
        <option value="">No linked account</option>
        <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
      </select>
    </label>
    <label class="field">
      Starts On
      <input v-model="startOn" type="date" required />
    </label>
    <label class="field">
      Target Date (optional)
      <input v-model="targetDate" type="date" />
    </label>
    <div class="actions">
      <button type="submit" class="btn btn-primary">{{ goal ? 'Save Changes' : 'Create Goal' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.goal-form {
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

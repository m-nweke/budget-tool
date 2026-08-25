<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Debt, CreateDebtDto } from '../types';

const props = defineProps<{
  debt: Debt | null;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  submit: [data: CreateDebtDto];
  cancel: [];
  edit: [];
}>();

const name = ref('');
const balance = ref<number | string>('');
const interestRate = ref<number | string>('');
const minimumPayment = ref<number | string>('');
const dueDay = ref<number | string>('');

watch(
  () => props.debt,
  (debt) => {
    name.value = debt ? debt.name : '';
    balance.value = debt ? debt.balance : '';
    interestRate.value = debt ? debt.interest_rate : '';
    minimumPayment.value = debt ? debt.minimum_payment : '';
    dueDay.value = debt ? debt.due_day : '';
  },
  { immediate: true }
);

function handleSubmit() {
  emit('submit', {
    name: name.value,
    balance: Number(balance.value),
    interest_rate: Number(interestRate.value),
    minimum_payment: Number(minimumPayment.value),
    due_day: Number(dueDay.value),
  });
}
</script>

<template>
  <form class="debt-form" @submit.prevent="handleSubmit">
    <fieldset class="fieldset-reset" :disabled="readonly">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Credit Card" required />
    </label>
    <label class="field">
      Balance
      <input v-model="balance" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <label class="field">
      Interest Rate (%)
      <input v-model="interestRate" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <label class="field">
      Minimum Payment
      <input v-model="minimumPayment" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <label class="field">
      Due Day of Month
      <input v-model="dueDay" type="number" step="1" min="1" max="31" placeholder="15" required />
    </label>
    </fieldset>
    <div v-if="!readonly" class="actions">
      <button type="submit" class="btn btn-primary">{{ debt ? 'Save Changes' : 'Create Debt' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn-primary" @click="$emit('edit')">Edit</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Close</button>
    </div>
  </form>
</template>

<style scoped>
.debt-form {
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

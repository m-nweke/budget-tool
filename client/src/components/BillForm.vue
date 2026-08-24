<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Bill, BillCategory, CreateBillDto } from '../types';

const props = defineProps<{
  bill: Bill | null;
}>();
const emit = defineEmits<{
  submit: [data: CreateBillDto];
  cancel: [];
}>();

const name = ref('');
const category = ref<BillCategory>('rent');
const amount = ref<number | string>('');
const dueDay = ref<number | string>('');
const active = ref(true);

watch(
  () => props.bill,
  (bill) => {
    name.value = bill ? bill.name : '';
    category.value = bill ? bill.category : 'rent';
    amount.value = bill ? bill.amount : '';
    dueDay.value = bill ? bill.due_day : '';
    active.value = bill ? bill.active === 1 : true;
  },
  { immediate: true }
);

function handleSubmit() {
  emit('submit', {
    name: name.value,
    category: category.value,
    amount: Number(amount.value),
    due_day: Number(dueDay.value),
    active: active.value,
  });
}
</script>

<template>
  <form class="bill-form" @submit.prevent="handleSubmit">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Rent" required />
    </label>
    <label class="field">
      Category
      <select v-model="category" required>
        <option value="rent">Rent</option>
        <option value="wifi">Wifi</option>
        <option value="electric">Electric</option>
        <option value="water">Water</option>
        <option value="insurance">Insurance</option>
        <option value="other">Other</option>
      </select>
    </label>
    <label class="field">
      Amount
      <input v-model="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <label class="field">
      Due Day of Month
      <input v-model="dueDay" type="number" step="1" min="1" max="31" placeholder="1" required />
    </label>
    <label class="field field-checkbox">
      <input v-model="active" type="checkbox" />
      Include in cash-flow simulation
    </label>
    <div class="actions">
      <button type="submit" class="btn btn-primary">{{ bill ? 'Save Changes' : 'Add Bill' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.bill-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 360px;
}

.field-checkbox {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.field-checkbox input {
  width: auto;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

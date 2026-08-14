<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, RecurringTransaction, UpdateRecurringTransactionDto, RecurrenceInterval } from '../types';

const props = defineProps<{
  recurringTransaction: RecurringTransaction;
  categories: Category[];
}>();
const emit = defineEmits<{
  submit: [data: UpdateRecurringTransactionDto];
  cancel: [];
}>();

const amount = ref<number | string>('');
const description = ref('');
const categoryId = ref<number | string>('');
const interval = ref<RecurrenceInterval>('monthly');
const endDate = ref('');

watch(
  () => props.recurringTransaction,
  (rt) => {
    amount.value = rt.amount;
    description.value = rt.description || '';
    categoryId.value = rt.category_id;
    interval.value = rt.interval;
    endDate.value = rt.end_date || '';
  },
  { immediate: true }
);

function handleSubmit() {
  emit('submit', {
    amount: Number(amount.value),
    description: description.value,
    category_id: Number(categoryId.value),
    interval: interval.value,
    end_date: endDate.value || null,
  });
}
</script>

<template>
  <form class="recurring-form" @submit.prevent="handleSubmit">
    <p class="scope-note">
      Editing this series affects future occurrences — transactions already generated stay as they are.
    </p>
    <div class="form-row">
      <label class="field">
        Amount
        <input v-model="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
      </label>
      <label class="field">
        Repeats
        <select v-model="interval">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
    </div>
    <label class="field">
      Description
      <input v-model="description" type="text" placeholder="e.g. Office chairs" />
    </label>
    <label class="field">
      Category
      <select v-model="categoryId" required>
        <option disabled value="">Select a category</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
    </label>
    <label class="field">
      Ends on (optional)
      <input v-model="endDate" type="date" />
    </label>
    <div class="actions">
      <button type="submit" class="btn btn-primary">Save Series</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.recurring-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 420px;
}

.scope-note {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  background: var(--color-primary-bg);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  margin: 0;
}

.form-row {
  display: flex;
  gap: var(--space-4);
}

.form-row .field {
  flex: 1;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

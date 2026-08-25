<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, RecurringTransaction, UpdateRecurringTransactionDto, RecurrenceInterval } from '../types';

const props = defineProps<{
  recurringTransaction: RecurringTransaction;
  categories: Category[];
  readonly?: boolean;
}>();
const emit = defineEmits<{
  submit: [data: UpdateRecurringTransactionDto];
  cancel: [];
  edit: [];
}>();

const amount = ref<number | string>('');
const description = ref('');
const categoryId = ref<number | string>('');
const interval = ref<RecurrenceInterval>('monthly');
const endDate = ref('');
const applyToExisting = ref(false);

watch(
  () => props.recurringTransaction,
  (rt) => {
    amount.value = rt.amount;
    description.value = rt.description || '';
    categoryId.value = rt.category_id;
    interval.value = rt.interval;
    endDate.value = rt.end_date || '';
    applyToExisting.value = false;
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
    apply_to_existing: applyToExisting.value,
  });
}
</script>

<template>
  <form class="recurring-form" @submit.prevent="handleSubmit">
    <fieldset class="fieldset-reset" :disabled="readonly">
    <p class="scope-note">
      By default, editing this series only affects future occurrences — transactions already generated stay as they
      are, unless you check the option below.
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
    <label class="checkbox-field">
      <input v-model="applyToExisting" type="checkbox" />
      Rebuild already-generated transactions under this new config
    </label>
    <p v-if="applyToExisting" class="warning-note">
      This deletes every transaction this series has already generated and regenerates them from scratch using the
      new amount, category, and interval — e.g. switching weekly → monthly replaces the weekly-spaced history with
      monthly-spaced history. This cannot be undone.
    </p>
    </fieldset>
    <div v-if="!readonly" class="actions">
      <button type="submit" class="btn btn-primary">Save Series</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn-primary" @click="$emit('edit')">Edit</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Close</button>
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

.checkbox-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  color: var(--color-text);
}

.warning-note {
  font-size: 0.85rem;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  margin: 0;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

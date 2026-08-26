<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, Transaction, CreateTransactionDto, RecurrenceInterval } from '../types';

const props = defineProps<{
  transaction: Transaction | null;
  categories: Category[];
  readonly?: boolean;
}>();
const emit = defineEmits<{
  submit: [
    data: CreateTransactionDto,
    recurrence: { recurring: boolean; interval: RecurrenceInterval; end_date: string | null }
  ];
  cancel: [];
  edit: [];
}>();

const amount = ref<number | string>('');
const date = ref('');
const description = ref('');
const categoryId = ref<number | string>('');
const recurring = ref(false);
const interval = ref<RecurrenceInterval>('monthly');
const endDate = ref('');

watch(
  () => props.transaction,
  (transaction) => {
    amount.value = transaction ? transaction.amount : '';
    date.value = transaction ? transaction.date : '';
    description.value = transaction ? transaction.description || '' : '';
    categoryId.value = transaction ? transaction.category_id : '';
  },
  { immediate: true }
);

function handleSubmit() {
  emit(
    'submit',
    {
      amount: Number(amount.value),
      date: date.value,
      description: description.value,
      category_id: Number(categoryId.value),
    },
    { recurring: recurring.value, interval: interval.value, end_date: endDate.value || null }
  );
}
</script>

<template>
  <form class="transaction-form" @submit.prevent="handleSubmit">
    <fieldset class="fieldset-reset" :disabled="readonly">
    <div class="form-row">
      <label class="field">
        Amount
        <input v-model="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
      </label>
      <label class="field">
        Date
        <input v-model="date" type="date" required />
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

    <template v-if="!transaction">
      <label class="checkbox-field">
        <input v-model="recurring" type="checkbox" />
        Repeat this transaction (e.g. a subscription)
      </label>

      <div v-if="recurring" class="form-row recurrence-fields">
        <label class="field">
          Repeats
          <select v-model="interval">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label class="field">
          Ends on (optional)
          <input v-model="endDate" type="date" />
        </label>
      </div>
    </template>

    </fieldset>
    <div v-if="!readonly" class="actions">
      <button type="submit" class="btn btn-primary">{{ transaction ? 'Save Changes' : 'Create Transaction' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn-primary" @click="$emit('edit')">Edit</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Close</button>
    </div>
  </form>
</template>

<style scoped>
.transaction-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 420px;
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

.recurrence-fields {
  padding: var(--space-3);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

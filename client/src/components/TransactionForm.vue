<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, Transaction, NewTransaction } from '../types';

const props = defineProps<{
  transaction: Transaction | null;
  categories: Category[];
}>();
const emit = defineEmits<{
  submit: [data: NewTransaction];
  cancel: [];
}>();

const amount = ref<number | string>('');
const date = ref('');
const description = ref('');
const categoryId = ref<number | string>('');

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
  emit('submit', {
    amount: Number(amount.value),
    date: date.value,
    description: description.value,
    category_id: Number(categoryId.value),
  });
}
</script>

<template>
  <form class="transaction-form" @submit.prevent="handleSubmit">
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
    <div class="actions">
      <button type="submit" class="btn btn-primary">{{ transaction ? 'Save Changes' : 'Create Transaction' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
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

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

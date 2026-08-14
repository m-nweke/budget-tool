<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  transaction: { type: Object, default: null },
  categories: { type: Array, required: true },
});
const emit = defineEmits(['submit', 'cancel']);

const amount = ref('');
const date = ref('');
const description = ref('');
const categoryId = ref('');

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
    <label>
      Amount
      <input v-model="amount" type="number" step="0.01" required />
    </label>
    <label>
      Date
      <input v-model="date" type="date" required />
    </label>
    <label>
      Description
      <input v-model="description" type="text" />
    </label>
    <label>
      Category
      <select v-model="categoryId" required>
        <option disabled value="">Select a category</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
    </label>
    <div class="actions">
      <button type="submit">{{ transaction ? 'Save' : 'Create' }}</button>
      <button type="button" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.transaction-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 320px;
  margin-bottom: 1.5rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}
</style>

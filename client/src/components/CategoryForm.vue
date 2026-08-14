<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, NewCategory } from '../types';

const props = defineProps<{
  category: Category | null;
}>();
const emit = defineEmits<{
  submit: [data: NewCategory];
  cancel: [];
}>();

const name = ref('');
const budgetedAmount = ref<number | string>('');

watch(
  () => props.category,
  (category) => {
    name.value = category ? category.name : '';
    budgetedAmount.value = category ? category.budgeted_amount : '';
  },
  { immediate: true }
);

function handleSubmit() {
  emit('submit', {
    name: name.value,
    budgeted_amount: Number(budgetedAmount.value),
  });
}
</script>

<template>
  <form class="category-form" @submit.prevent="handleSubmit">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Office Supplies" required />
    </label>
    <label class="field">
      Budgeted Amount
      <input v-model="budgetedAmount" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <div class="actions">
      <button type="submit" class="btn btn-primary">{{ category ? 'Save Changes' : 'Create Category' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.category-form {
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

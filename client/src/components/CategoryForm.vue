<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, CreateCategoryDto } from '../types';

const props = defineProps<{
  category: Category | null;
}>();
const emit = defineEmits<{
  submit: [data: CreateCategoryDto];
  cancel: [];
}>();

const name = ref('');
const budgetedAmount = ref<number | string>('');
const startOn = ref(new Date().toISOString().slice(0, 10));

watch(
  () => props.category,
  (category) => {
    name.value = category ? category.name : '';
    budgetedAmount.value = category ? category.budgeted_amount : '';
    startOn.value = category ? category.start_on : new Date().toISOString().slice(0, 10);
  },
  { immediate: true }
);

function handleSubmit() {
  emit('submit', {
    name: name.value,
    budgeted_amount: Number(budgetedAmount.value),
    start_on: startOn.value,
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
    <label class="field">
      Starts On
      <input v-model="startOn" type="date" required />
    </label>
    <p class="field-hint">
      The month this budget takes effect from — the dashboard only shows this category for months on or after this date. Backdate it if you're logging older transactions against it.
    </p>
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

.field-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: calc(var(--space-2) * -1);
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

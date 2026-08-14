<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category } from '../types';

const props = defineProps<{ category: Category | null }>();
const emit = defineEmits<{ submit: [payload: { name: string; budgeted_amount: number; start_on?: string }]; cancel: [] }>();

const name = ref('');
const budgetedAmount = ref<number>(0);
const startOn = ref('');

watch(
  () => props.category,
  (category) => {
    name.value = category?.name ?? '';
    budgetedAmount.value = category?.budgeted_amount ?? 0;
    startOn.value = category?.start_on ?? new Date().toISOString().slice(0, 10);
  },
  { immediate: true }
);

function onSubmit() {
  emit('submit', { name: name.value, budgeted_amount: Number(budgetedAmount.value), start_on: startOn.value });
}
</script>

<template>
  <form class="card form" @submit.prevent="onSubmit">
    <h3>{{ props.category ? 'Edit Category' : 'New Category' }}</h3>

    <label>
      Name
      <input v-model="name" required />
    </label>

    <label>
      Budgeted Amount (monthly)
      <input v-model.number="budgetedAmount" type="number" step="0.01" min="0" required />
    </label>

    <label>
      Start On
      <input v-model="startOn" type="date" required />
      <small>Drives which months' dashboards this category appears on and gets budget-scaled for — not when the row was created.</small>
    </label>

    <div class="form-actions">
      <button type="submit" class="primary">{{ props.category ? 'Save' : 'Create' }}</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

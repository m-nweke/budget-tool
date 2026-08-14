<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, RecurringTransaction, Interval } from '../types';

const props = defineProps<{ recurring: RecurringTransaction | null; categories: Category[] }>();
const emit = defineEmits<{
  submit: [
    payload: {
      amount: number;
      description: string;
      category_id: number;
      interval: Interval;
      end_date: string;
      apply_to_existing: boolean;
    }
  ];
  cancel: [];
}>();

const amount = ref<number>(0);
const description = ref('');
const categoryId = ref<number | null>(null);
const interval = ref<Interval>('monthly');
const endDate = ref('');
const applyToExisting = ref(false);

watch(
  () => props.recurring,
  (recurring) => {
    amount.value = recurring?.amount ?? 0;
    description.value = recurring?.description ?? '';
    categoryId.value = recurring?.category_id ?? (props.categories.length === 1 ? props.categories[0].id : null);
    interval.value = recurring?.interval ?? 'monthly';
    endDate.value = recurring?.end_date ?? '';
    applyToExisting.value = false;
  },
  { immediate: true }
);

function onSubmit() {
  if (categoryId.value === null) return;
  emit('submit', {
    amount: Number(amount.value),
    description: description.value,
    category_id: categoryId.value,
    interval: interval.value,
    end_date: endDate.value,
    apply_to_existing: applyToExisting.value,
  });
}
</script>

<template>
  <form class="card form" @submit.prevent="onSubmit">
    <h3>Edit Recurring Series</h3>

    <label>
      Category
      <select v-model.number="categoryId" required>
        <option v-for="c in props.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>

    <label>
      Amount
      <input v-model.number="amount" type="number" step="0.01" required />
    </label>

    <label>
      Description
      <input v-model="description" />
    </label>

    <label>
      Interval
      <select v-model="interval">
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </label>

    <label>
      End Date (optional)
      <input v-model="endDate" type="date" />
    </label>

    <label class="checkbox-label warning">
      <input v-model="applyToExisting" type="checkbox" />
      Rebuild history with new config (destructive: deletes and regenerates all previously-generated transactions for this series)
    </label>

    <div class="form-actions">
      <button type="submit" class="primary">Save</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

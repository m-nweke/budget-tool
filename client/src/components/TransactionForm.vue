<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, Transaction, Interval } from '../types';

const props = defineProps<{ transaction: Transaction | null; categories: Category[] }>();
const emit = defineEmits<{
  submit: [
    payload: {
      amount: number;
      date: string;
      description: string;
      category_id: number;
      repeat: boolean;
      interval: Interval;
      end_date: string;
    }
  ];
  cancel: [];
}>();

const amount = ref<number>(0);
const date = ref('');
const description = ref('');
const categoryId = ref<number | null>(null);
const repeat = ref(false);
const interval = ref<Interval>('monthly');
const endDate = ref('');

watch(
  () => props.transaction,
  (transaction) => {
    amount.value = transaction?.amount ?? 0;
    date.value = transaction?.date ?? new Date().toISOString().slice(0, 10);
    description.value = transaction?.description ?? '';
    categoryId.value = transaction?.category_id ?? (props.categories.length === 1 ? props.categories[0].id : null);
    repeat.value = false;
    interval.value = 'monthly';
    endDate.value = '';
  },
  { immediate: true }
);

function onSubmit() {
  if (categoryId.value === null) return;
  emit('submit', {
    amount: Number(amount.value),
    date: date.value,
    description: description.value,
    category_id: categoryId.value,
    repeat: repeat.value,
    interval: interval.value,
    end_date: endDate.value,
  });
}
</script>

<template>
  <form class="card form" @submit.prevent="onSubmit">
    <h3>{{ props.transaction ? 'Edit Transaction' : 'New Transaction' }}</h3>

    <label>
      Category
      <select v-model.number="categoryId" required>
        <option :value="null" disabled>Select a category</option>
        <option v-for="c in props.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>

    <label>
      Amount
      <input v-model.number="amount" type="number" step="0.01" required />
    </label>

    <label>
      Date
      <input v-model="date" type="date" required />
    </label>

    <label>
      Description
      <input v-model="description" />
    </label>

    <label v-if="!props.transaction" class="checkbox-label">
      <input v-model="repeat" type="checkbox" />
      Repeat this transaction
    </label>

    <template v-if="repeat && !props.transaction">
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
    </template>

    <div class="form-actions">
      <button type="submit" class="primary">{{ props.transaction ? 'Save' : 'Create' }}</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

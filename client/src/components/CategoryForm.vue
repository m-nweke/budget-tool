<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  category: { type: Object, default: null },
});
const emit = defineEmits(['submit', 'cancel']);

const name = ref('');
const budgetedAmount = ref('');

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
    <label>
      Name
      <input v-model="name" type="text" required />
    </label>
    <label>
      Budgeted Amount
      <input v-model="budgetedAmount" type="number" step="0.01" required />
    </label>
    <div class="actions">
      <button type="submit">{{ category ? 'Save' : 'Create' }}</button>
      <button type="button" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.category-form {
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

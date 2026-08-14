<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';

const rows = ref([]);
const error = ref('');

async function loadDashboard() {
  try {
    rows.value = await api.getDashboard();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <h1>Dashboard</h1>
  <p v-if="error" class="error">{{ error }}</p>

  <div class="card-grid">
    <div
      v-for="row in rows"
      :key="row.category_id"
      class="card"
      :class="{ over: row.actual_spend > row.budgeted_amount }"
    >
      <h2>{{ row.name }}</h2>
      <p>Budgeted: ${{ row.budgeted_amount.toFixed(2) }}</p>
      <p>Actual: ${{ row.actual_spend.toFixed(2) }}</p>
      <p>Difference: ${{ row.difference.toFixed(2) }}</p>
    </div>
  </div>
</template>

<style scoped>
.error {
  color: #b91c1c;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
}

.card.over {
  border-color: #b91c1c;
  background: #fef2f2;
}

.card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.card p {
  margin: 0.25rem 0;
}
</style>

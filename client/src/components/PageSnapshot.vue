<script setup lang="ts">
defineProps<{
  title: string;
  to: string;
  stats: {
    label: string;
    value: string;
    tone?: 'default' | 'danger' | 'warning' | 'success';
  }[];
}>();
</script>

<template>
  <RouterLink :to="to" class="card page-snapshot">
    <h3>{{ title }}</h3>
    <div class="snapshot-stats">
      <div v-for="stat in stats" :key="stat.label" class="snapshot-stat">
        <span class="snapshot-label">{{ stat.label }}</span>
        <span class="snapshot-value" :class="stat.tone ? `tone-${stat.tone}` : ''">{{ stat.value }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.page-snapshot {
  display: block;
  padding: var(--space-5);
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.page-snapshot:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.page-snapshot h3 {
  margin-bottom: var(--space-3);
}

.snapshot-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.snapshot-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.snapshot-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.snapshot-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.snapshot-value.tone-danger {
  color: var(--color-danger);
}

.snapshot-value.tone-warning {
  color: var(--color-warning);
}

.snapshot-value.tone-success {
  color: var(--color-success);
}
</style>

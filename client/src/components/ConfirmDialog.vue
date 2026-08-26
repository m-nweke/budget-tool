<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }>(),
  {
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  }
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancel');
}

onMounted(() => document.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <div v-if="open" class="confirm-overlay" @click.self="emit('cancel')">
    <div class="confirm-dialog panel" role="alertdialog" aria-modal="true" :aria-label="title">
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-secondary" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button type="button" class="btn btn-danger" @click="emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.4);
  z-index: 100;
  padding: var(--space-4);
}

.confirm-dialog {
  width: 100%;
  max-width: 360px;
}

.confirm-dialog h2 {
  margin-bottom: var(--space-2);
}

.confirm-dialog p {
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>

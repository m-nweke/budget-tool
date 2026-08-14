<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function handleClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    close();
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside));

defineExpose({ close });
</script>

<template>
  <div ref="root" class="kebab-menu">
    <button type="button" class="kebab-trigger" aria-label="Actions" @click="toggle">⋮</button>
    <ul v-if="open" class="kebab-dropdown" @click="close">
      <slot />
    </ul>
  </div>
</template>

<style scoped>
.kebab-menu {
  position: relative;
  display: inline-flex;
}

.kebab-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 1.1rem;
  line-height: 1;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.kebab-trigger:hover {
  background: var(--color-bg);
  border-color: var(--color-border);
  color: var(--color-text);
}

.kebab-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 120px;
  list-style: none;
  margin: 0;
  padding: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 20;
}

.kebab-dropdown :deep(button) {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  font: inherit;
  font-size: 0.85rem;
  color: var(--color-text);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.kebab-dropdown :deep(button:hover) {
  background: var(--color-bg);
}

.kebab-dropdown :deep(button.danger) {
  color: var(--color-danger);
}
</style>

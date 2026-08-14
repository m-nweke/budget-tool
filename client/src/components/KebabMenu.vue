<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));
</script>

<template>
  <div class="kebab" ref="rootEl">
    <button class="kebab-trigger" type="button" @click="toggle" aria-label="Row actions">&#8942;</button>
    <div v-if="open" class="kebab-menu" @click="open = false">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.kebab {
  position: relative;
  display: inline-block;
}
.kebab-trigger {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  padding: 0.25rem 0.5rem;
  color: #555;
}
.kebab-trigger:hover {
  color: #111;
}
.kebab-menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 20;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  min-width: 140px;
  overflow: hidden;
}
.kebab-menu :deep(button) {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
}
.kebab-menu :deep(button:hover) {
  background: #f2f2f2;
}
</style>

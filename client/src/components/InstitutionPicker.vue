<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { BANK_INSTITUTIONS, OTHER_INSTITUTION } from '../data/bankInstitutions';
import BankLogo from './BankLogo.vue';

// A custom listbox standing in for a native <select> specifically so each
// option can show its real bank logo — a plain <option> can't render an
// <img>/component in any browser, so AccountForm.vue's institution field
// can't just add a logo to the existing <select>. Same open/close-on-
// outside-click shape as KebabMenu.vue.
const props = defineProps<{
  modelValue: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const search = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

const selectedLabel = computed(() => {
  if (props.modelValue === OTHER_INSTITUTION) return 'Other';
  if (!props.modelValue) return 'None';
  return props.modelValue;
});

// BANK_INSTITUTIONS is already alphabetical (see bankInstitutions.ts) —
// filtering preserves that order rather than re-sorting.
const filteredBanks = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return BANK_INSTITUTIONS;
  return BANK_INSTITUTIONS.filter((bank) => bank.name.toLowerCase().includes(query));
});

function select(value: string) {
  emit('update:modelValue', value);
  open.value = false;
}

async function toggle() {
  open.value = !open.value;
  if (open.value) {
    search.value = '';
    await nextTick();
    searchInput.value?.focus();
  }
}

function handleClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    open.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside));
</script>

<template>
  <div ref="root" class="institution-picker" @keydown.stop="handleKeydown">
    <button
      type="button"
      class="picker-trigger form-control"
      :class="{ open }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="picker-selected">
        <BankLogo v-if="modelValue && modelValue !== OTHER_INSTITUTION" :institution="modelValue" size="1.3em" />
        {{ selectedLabel }}
      </span>
      <span class="picker-chevron" aria-hidden="true">▾</span>
    </button>
    <div v-if="open" class="picker-dropdown">
      <input
        ref="searchInput"
        v-model="search"
        type="text"
        class="picker-search"
        placeholder="Search banks…"
        @click.stop
      />
      <ul role="listbox">
        <li>
          <button type="button" role="option" :aria-selected="modelValue === ''" @click="select('')">None</button>
        </li>
        <li v-for="bank in filteredBanks" :key="bank.name">
          <button type="button" role="option" :aria-selected="modelValue === bank.name" @click="select(bank.name)">
            <BankLogo :institution="bank.name" size="1.3em" />
            {{ bank.name }}
          </button>
        </li>
        <li v-if="!filteredBanks.length" class="picker-empty">No banks match "{{ search }}"</li>
        <li>
          <button
            type="button"
            role="option"
            :aria-selected="modelValue === OTHER_INSTITUTION"
            @click="select(OTHER_INSTITUTION)"
          >
            Other
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.institution-picker {
  position: relative;
}

.picker-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  text-align: left;
}

.picker-trigger.open {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.picker-selected {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-chevron {
  flex: none;
  margin-left: var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.8em;
}

.picker-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 20;
  overflow: hidden;
}

.picker-search {
  display: block;
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 0.9rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: none;
  border-bottom: 1px solid var(--color-border);
  padding: 9px 10px;
  border-radius: 0;
}

.picker-search:focus {
  outline: none;
  background: var(--color-bg);
}

.picker-dropdown ul {
  max-height: 240px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: var(--space-1);
}

.picker-empty {
  padding: 6px 8px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.picker-dropdown button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  font: inherit;
  font-size: 0.9rem;
  color: var(--color-text);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  cursor: pointer;
}

.picker-dropdown button:hover,
.picker-dropdown button[aria-selected='true'] {
  background: var(--color-bg);
}
</style>

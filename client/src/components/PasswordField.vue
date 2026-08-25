<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  modelValue: string;
  autocomplete: string;
  minlength?: number;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();

const showPassword = ref(false);
</script>

<template>
  <div class="password-field">
    <input
      :value="modelValue"
      :type="showPassword ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :minlength="minlength"
      required
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="password-toggle"
      :aria-label="showPassword ? 'Hide password' : 'Show password'"
      @click="showPassword = !showPassword"
    >
      {{ showPassword ? 'Hide' : 'Show' }}
    </button>
  </div>
</template>

<style scoped>
.password-field {
  position: relative;
  display: flex;
}

.password-field input {
  width: 100%;
  padding-right: 56px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.password-toggle:hover {
  color: var(--color-primary);
}

.password-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { getInstitutionMeta } from '../data/bankInstitutions';

// Renders a small colored letter-mark badge for the account's institution.
// AccountsView falls back to the type emoji when this has nothing to show
// (institution is null) — this component only owns the "institution is
// set" rendering, not the fallback.
const props = defineProps<{
  institution: string | null;
}>();

const meta = computed(() => getInstitutionMeta(props.institution));
</script>

<template>
  <span v-if="meta" class="bank-logo" :style="{ background: meta.color }" :title="meta.name" :aria-label="meta.name">
    {{ meta.mark }}
  </span>
</template>

<style scoped>
.bank-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  color: #fff;
  font-size: 0.6em;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  vertical-align: middle;
  margin-right: var(--space-1);
}
</style>

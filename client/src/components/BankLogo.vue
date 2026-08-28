<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getInstitutionMeta, logoUrl } from '../data/bankInstitutions';

// Renders the account's institution: a curated bank's real logo (fetched
// live from Google's public favicon service, keyed off the bank's domain —
// see bankInstitutions.ts) when available, otherwise a colored letter-mark
// badge. AccountsView falls back to the type emoji when this has nothing
// to show at all (institution is null) — this component only owns the
// "institution is set" rendering, not that outer fallback.
const props = defineProps<{
  institution: string | null;
}>();

const meta = computed(() => getInstitutionMeta(props.institution));
const url = computed(() => (meta.value ? logoUrl(meta.value) : null));
// A failed/slow image load shouldn't leave a broken-image icon in a
// financial account list — falls back to the letter-mark badge instead.
const imageFailed = ref(false);
watch(url, () => {
  imageFailed.value = false;
});
</script>

<template>
  <img
    v-if="meta && url && !imageFailed"
    class="bank-logo bank-logo-img"
    :src="url"
    :alt="meta.name"
    :title="meta.name"
    @error="imageFailed = true"
  />
  <span v-else-if="meta" class="bank-logo" :style="{ background: meta.color }" :title="meta.name" :aria-label="meta.name">
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

.bank-logo-img {
  object-fit: contain;
  background: #fff;
  padding: 2px;
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getInstitutionMeta, logoUrl } from '../data/bankInstitutions';

// Renders the account's institution: a curated bank's real logo (fetched
// live from Google's public favicon service, keyed off the bank's domain —
// see bankInstitutions.ts) when available, otherwise a colored letter-mark
// badge. AccountsView falls back to the type emoji when this has nothing
// to show at all (institution is null) — this component only owns the
// "institution is set" rendering, not that outer fallback.
const props = withDefaults(
  defineProps<{
    institution: string | null;
    // CSS size (e.g. '1.5em', '2rem') — defaults to the inline-badge size
    // used in list rows. Views that want the logo more prominent (e.g. a
    // Cash Flow account card header) pass a larger explicit size instead.
    size?: string;
  }>(),
  { size: '1.5em' }
);

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
    :style="{ width: size, height: size }"
    :src="url"
    :alt="meta.name"
    :title="meta.name"
    @error="imageFailed = true"
  />
  <span
    v-else-if="meta"
    class="bank-logo"
    :style="{ width: size, height: size, background: meta.color }"
    :title="meta.name"
    :aria-label="meta.name"
  >
    {{ meta.mark }}
  </span>
</template>

<style scoped>
.bank-logo {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
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

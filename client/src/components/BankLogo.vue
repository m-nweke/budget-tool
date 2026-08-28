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
    // 'circle' (default) matches the compact inline badges used in split
    // lists/meta lines. 'squircle' (a rounded-square, app-icon-style mark)
    // reads better at the larger sizes used in a primary list like
    // AccountsView, where the logo is the row's focal point rather than an
    // inline aside.
    shape?: 'circle' | 'squircle';
  }>(),
  { size: '1.5em', shape: 'circle' }
);

const meta = computed(() => getInstitutionMeta(props.institution));
const url = computed(() => (meta.value ? logoUrl(meta.value) : null));
// A failed/slow image load shouldn't leave a broken-image icon in a
// financial account list — falls back to the letter-mark badge instead.
const imageFailed = ref(false);
watch(url, () => {
  imageFailed.value = false;
});

// Google's favicon endpoint serves whatever icon size a site actually
// publishes — some banks (Commerce Bank, Ally) only have a 16x16
// favicon.ico, which upscales to a visibly blocky mess at badge size. A
// crisp small icon reads better as the letter-mark fallback than a
// blurry/pixelated real one, so a too-small natural size is treated the
// same as a failed load.
const MIN_NATURAL_SIZE = 32;
function handleImageLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  if (img.naturalWidth < MIN_NATURAL_SIZE || img.naturalHeight < MIN_NATURAL_SIZE) {
    imageFailed.value = true;
  }
}
</script>

<template>
  <img
    v-if="meta && url && !imageFailed"
    class="bank-logo bank-logo-img"
    :class="`shape-${shape}`"
    :style="{ width: size, height: size }"
    :src="url"
    :alt="meta.name"
    :title="meta.name"
    @error="imageFailed = true"
    @load="handleImageLoad"
  />
  <span
    v-else-if="meta"
    class="bank-logo"
    :class="`shape-${shape}`"
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
  color: #fff;
  font-size: 0.6em;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  vertical-align: middle;
}

.bank-logo.shape-circle {
  border-radius: 50%;
}

/* Approximates an iOS-style superellipse — a true squircle needs a
   clip-path superellipse formula, but border-radius at this percentage
   reads as one at icon sizes without the extra cost/complexity. */
.bank-logo.shape-squircle {
  border-radius: 28%;
}

.bank-logo-img {
  object-fit: contain;
  background: #fff;
  padding: 2px;
}
</style>

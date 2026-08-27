<script setup lang="ts">
// Original mark — not Monarch's butterfly, not Origin's assets (design doc
// IP notes: "inspired by," never copied). A single monoline ascending path
// inside a circle: growth/trajectory as the idea, drawn in the Origin-
// inspired thin-stroke style. Uses currentColor so it repaints with
// --color-primary across all 6 theme/mode combinations for free.
withDefaults(defineProps<{ size?: number }>(), { size: 22 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9.5" />
    <path d="M7 14.5l3-3.5 2.5 2 4.5-6" />
  </svg>
</template>

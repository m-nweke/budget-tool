<script setup lang="ts">
import { computed } from 'vue';
import type { AccountDailyBalance } from '../types';
import { formatCurrency } from '../utils/format';

const props = defineProps<{ daily: AccountDailyBalance[] }>();

// Hand-rolled SVG rather than a charting library — the design doc's own
// selection criteria (bundle size, native Vue reactivity, gradient/area
// fill support) all point the same direction for a single line/area
// chart: zero bytes added, full control over the gradient-fill look,
// no library API to learn for something this small.
const WIDTH = 600;
const HEIGHT = 160;
const PAD_Y = 12;

const points = computed(() => {
  const days = props.daily;
  if (days.length === 0) return [];
  const values = days.map((d) => d.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const usableHeight = HEIGHT - PAD_Y * 2;

  // A single-point projection can't form a line — render it as one flat
  // segment spanning the full width so it still reads as "the balance",
  // not a broken/invisible chart.
  const denom = Math.max(days.length - 1, 1);

  return days.map((d, i) => {
    const x = days.length === 1 ? 0 : (i / denom) * WIDTH;
    const y = PAD_Y + usableHeight - ((d.balance - min) / range) * usableHeight;
    return { x, y, date: d.date, balance: d.balance };
  });
});

const zeroY = computed(() => {
  const days = props.daily;
  if (days.length === 0) return null;
  const values = days.map((d) => d.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  // Only draw the reference line when it's actually inside the plotted
  // range — otherwise it'd sit on the edge and just look like a border.
  if (min >= 0 || max <= 0) return null;
  const usableHeight = HEIGHT - PAD_Y * 2;
  return PAD_Y + usableHeight - ((0 - min) / range) * usableHeight;
});

const hasNegative = computed(() => props.daily.some((d) => d.balance < 0));

const linePath = computed(() => {
  const pts = points.value;
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M 0 ${pts[0].y} L ${WIDTH} ${pts[0].y}`;
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
});

const areaPath = computed(() => {
  const pts = points.value;
  if (pts.length === 0) return '';
  if (pts.length === 1) {
    return `M 0 ${pts[0].y} L ${WIDTH} ${pts[0].y} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;
  }
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return `${line} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;
});

const gradientId = `balance-gradient-${Math.random().toString(36).slice(2, 9)}`;
</script>

<template>
  <div class="balance-chart">
    <svg
      v-if="points.length"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      class="chart-svg"
      :class="{ negative: hasNegative }"
      role="img"
      :aria-label="`Projected balance from ${formatCurrency(daily[0].balance)} to ${formatCurrency(daily[daily.length - 1].balance)} over ${daily.length} day${daily.length === 1 ? '' : 's'}`"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" class="gradient-start" />
          <stop offset="100%" class="gradient-end" />
        </linearGradient>
      </defs>
      <path :d="areaPath" :fill="`url(#${gradientId})`" stroke="none" />
      <line v-if="zeroY !== null" :x1="0" :x2="WIDTH" :y1="zeroY" :y2="zeroY" class="zero-line" />
      <path :d="linePath" fill="none" class="balance-line" />
    </svg>
    <p v-else class="chart-empty">No projection data.</p>
  </div>
</template>

<style scoped>
.balance-chart {
  width: 100%;
}

.chart-svg {
  width: 100%;
  height: 160px;
  display: block;
}

.gradient-start {
  stop-color: var(--color-primary);
  stop-opacity: 0.32;
}

.gradient-end {
  stop-color: var(--color-primary);
  stop-opacity: 0;
}

.chart-svg.negative .gradient-start {
  stop-color: var(--color-danger);
  stop-opacity: 0.28;
}

.balance-line {
  stroke: var(--color-primary);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.chart-svg.negative .balance-line {
  stroke: var(--color-danger);
}

.zero-line {
  stroke: var(--color-border);
  stroke-width: 1;
  stroke-dasharray: 4 3;
  vector-effect: non-scaling-stroke;
}

.chart-empty {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  padding: var(--space-4) 0;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectedOutflow } from '../types';
import { formatCurrency } from '../utils/format';

const props = defineProps<{ outflows: ProjectedOutflow[] }>();

// Coarse 4-bucket breakdown (design doc stretch goal): a true Sankey shape
// was prototyped first and dropped per the doc's own gate — with only 2-4
// buckets and a single source, the flow bands rendered as flat blocks, not
// curves, and read as a toy rather than useful. Color-coded horizontal
// magnitude bars is the pattern Monarch's own reference screenshot used
// for "Top Expense Categories" — it reads correctly at any bucket count,
// unlike a Sankey that only looks right with many nodes.
const BUCKET_LABELS: Record<string, string> = {
  recurring_transaction: 'Recurring',
  bill: 'Bills',
  debt: 'Debt',
  investment: 'Investment',
};

const BUCKET_EMOJI: Record<string, string> = {
  recurring_transaction: '🔁',
  bill: '🧾',
  debt: '💳',
  investment: '📈',
};

const BUCKET_COLOR: Record<string, string> = {
  recurring_transaction: 'var(--color-primary)',
  bill: 'var(--color-warning)',
  debt: 'var(--color-danger)',
  investment: 'var(--color-success)',
};

const BUCKET_ORDER = ['bill', 'recurring_transaction', 'debt', 'investment'] as const;

const buckets = computed(() => {
  const totals = new Map<string, number>();
  for (const o of props.outflows) {
    totals.set(o.source, (totals.get(o.source) ?? 0) + o.amount);
  }
  return BUCKET_ORDER.map((source) => ({ source, total: totals.get(source) ?? 0 }))
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total);
});

const maxTotal = computed(() => Math.max(...buckets.value.map((b) => b.total), 1));
</script>

<template>
  <ul v-if="buckets.length" class="breakdown-list">
    <li v-for="bucket in buckets" :key="bucket.source" class="breakdown-row">
      <span class="breakdown-label">
        <span aria-hidden="true">{{ BUCKET_EMOJI[bucket.source] }}</span>
        {{ BUCKET_LABELS[bucket.source] }}
      </span>
      <span class="breakdown-bar-track">
        <span
          class="breakdown-bar-fill"
          :style="{ width: `${(bucket.total / maxTotal) * 100}%`, background: BUCKET_COLOR[bucket.source] }"
        />
      </span>
      <span class="breakdown-amount font-mono">{{ formatCurrency(bucket.total) }}</span>
    </li>
  </ul>
  <p v-else class="breakdown-empty">Nothing to break down in this window.</p>
</template>

<style scoped>
.breakdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.breakdown-row {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  align-items: center;
  gap: var(--space-3);
}

.breakdown-label {
  font-size: 0.85rem;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 4px;
}

.breakdown-bar-track {
  height: 10px;
  border-radius: 999px;
  background: var(--color-bg);
  overflow: hidden;
}

.breakdown-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s;
}

.breakdown-amount {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.breakdown-empty {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

@media (max-width: 480px) {
  .breakdown-row {
    grid-template-columns: 90px 1fr auto;
  }
}
</style>

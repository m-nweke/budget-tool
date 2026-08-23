<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import { formatCurrency } from '../utils/format';
import type { CashFlowResult, CashFlowEvent } from '../types';

const result = ref<CashFlowResult | null>(null);
const months = ref(3);
const loading = ref(false);
const error = ref('');

const MONTH_OPTIONS = [1, 3, 6, 12];

async function load() {
  loading.value = true;
  error.value = '';
  try {
    result.value = await api.getCashFlow(months.value);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// --- Chart geometry ---

const PAD_LEFT = 72;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 36;
const SVG_W = 800;
const SVG_H = 280;
const PLOT_W = SVG_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

const snapshots = computed(() => result.value?.snapshots ?? []);

const dateRange = computed(() => {
  if (!result.value) return { start: 0, end: 1 };
  return {
    start: new Date(result.value.start_date + 'T00:00:00Z').getTime(),
    end: new Date(result.value.end_date + 'T00:00:00Z').getTime(),
  };
});

const balanceRange = computed(() => {
  const snaps = snapshots.value;
  if (snaps.length === 0) return { min: 0, max: 1000 };
  const values = snaps.map((s) => s.total_balance);
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 100);
  return { min: min - padding, max: max + padding };
});

function toX(dateStr: string): number {
  const t = new Date(dateStr + 'T00:00:00Z').getTime();
  const { start, end } = dateRange.value;
  return PAD_LEFT + ((t - start) / (end - start)) * PLOT_W;
}

function toY(balance: number): number {
  const { min, max } = balanceRange.value;
  return PAD_TOP + (1 - (balance - min) / (max - min)) * PLOT_H;
}

const linePath = computed(() => {
  const snaps = snapshots.value;
  if (snaps.length === 0) return '';
  return snaps
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${toX(s.date).toFixed(1)},${toY(s.total_balance).toFixed(1)}`)
    .join(' ');
});

const areaPath = computed(() => {
  const snaps = snapshots.value;
  if (snaps.length === 0) return '';
  const zeroY = toY(0).toFixed(1);
  const first = `M${toX(snaps[0].date).toFixed(1)},${zeroY}`;
  const line = snaps
    .map((s) => `L${toX(s.date).toFixed(1)},${toY(s.total_balance).toFixed(1)}`)
    .join(' ');
  const last = `L${toX(snaps[snaps.length - 1].date).toFixed(1)},${zeroY} Z`;
  return `${first} ${line} ${last}`;
});

// Y-axis: 5 evenly spaced ticks
const yTicks = computed(() => {
  const { min, max } = balanceRange.value;
  return Array.from({ length: 5 }, (_, i) => {
    const value = min + (i / 4) * (max - min);
    return { value, y: toY(value) };
  });
});

// X-axis: 1st of each month in range
const xTicks = computed(() => {
  if (!result.value) return [];
  const ticks: Array<{ label: string; x: number }> = [];
  const start = new Date(result.value.start_date + 'T00:00:00Z');
  const end = new Date(result.value.end_date + 'T00:00:00Z');
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  cursor.setUTCMonth(cursor.getUTCMonth() + 1); // first full month after start

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    ticks.push({
      label: cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      x: toX(dateStr),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
});

// Income/expense dots for events (one per unique date, combined)
const eventDots = computed(() => {
  if (!result.value) return [];
  const byDate = new Map<string, number>();
  for (const ev of result.value.events) {
    byDate.set(ev.date, (byDate.get(ev.date) ?? 0) + ev.amount);
  }
  return Array.from(byDate.entries()).map(([date, total]) => ({
    date,
    total,
    x: toX(date),
    y: toY((snapshots.value.find((s) => s.date === date)?.total_balance) ?? 0),
    positive: total > 0,
  }));
});

// Zero line — only show if zero is in range
const zeroLineY = computed(() => {
  const { min, max } = balanceRange.value;
  if (0 >= min && 0 <= max) return toY(0);
  return null;
});

// --- Event list ---

interface GroupedDate {
  date: string;
  events: CashFlowEvent[];
  dayTotal: number;
}

const groupedEvents = computed((): GroupedDate[] => {
  if (!result.value) return [];
  const groups = new Map<string, CashFlowEvent[]>();
  for (const ev of result.value.events) {
    if (!groups.has(ev.date)) groups.set(ev.date, []);
    groups.get(ev.date)!.push(ev);
  }
  return Array.from(groups.entries()).map(([date, events]) => ({
    date,
    events,
    dayTotal: events.reduce((s, e) => s + e.amount, 0),
  }));
});

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function eventLabel(type: CashFlowEvent['type']): string {
  if (type === 'paycheck') return 'Income';
  if (type === 'debt_payment') return 'Debt';
  return 'Recurring';
}
</script>

<template>
  <div class="view-header">
    <div>
      <h1>Cash Flow</h1>
      <p>Projected balance based on your paychecks, debts, and recurring transactions.</p>
    </div>
    <div class="range-picker">
      <button
        v-for="m in MONTH_OPTIONS"
        :key="m"
        type="button"
        class="range-btn"
        :class="{ active: months === m }"
        @click="months = m; load()"
      >
        {{ m }}mo
      </button>
    </div>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="loading && !result" class="loading-placeholder" />

  <template v-if="result">
    <!-- Summary stats -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">Current Balance</div>
        <div class="stat-value">{{ formatCurrency(result.snapshots[0]?.total_balance ?? 0) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Projected Balance</div>
        <div class="stat-value" :class="result.projected_end_balance >= 0 ? 'positive' : 'negative'">
          {{ formatCurrency(result.projected_end_balance) }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Projected Income</div>
        <div class="stat-value positive">+{{ formatCurrency(result.total_income) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Projected Expenses</div>
        <div class="stat-value negative">-{{ formatCurrency(result.total_expenses) }}</div>
      </div>
    </div>

    <!-- Chart -->
    <div class="panel chart-panel">
      <svg
        :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
        class="chart-svg"
        aria-label="Projected balance chart"
        role="img"
      >
        <!-- Grid lines and Y labels -->
        <g v-for="tick in yTicks" :key="tick.value">
          <line
            :x1="PAD_LEFT" :y1="tick.y.toFixed(1)"
            :x2="SVG_W - PAD_RIGHT" :y2="tick.y.toFixed(1)"
            class="grid-line"
          />
          <text :x="PAD_LEFT - 6" :y="tick.y.toFixed(1)" class="axis-label y-label">
            {{ formatCurrency(tick.value) }}
          </text>
        </g>

        <!-- Zero line -->
        <line
          v-if="zeroLineY !== null"
          :x1="PAD_LEFT" :y1="zeroLineY.toFixed(1)"
          :x2="SVG_W - PAD_RIGHT" :y2="zeroLineY.toFixed(1)"
          class="zero-line"
        />

        <!-- X axis labels -->
        <g v-for="tick in xTicks" :key="tick.label + tick.x">
          <line
            :x1="tick.x.toFixed(1)" :y1="PAD_TOP"
            :x2="tick.x.toFixed(1)" :y2="SVG_H - PAD_BOTTOM"
            class="grid-line"
          />
          <text :x="tick.x.toFixed(1)" :y="SVG_H - PAD_BOTTOM + 16" class="axis-label x-label">
            {{ tick.label }}
          </text>
        </g>

        <!-- Area fill -->
        <path v-if="areaPath" :d="areaPath" class="area-fill" />

        <!-- Balance line -->
        <path v-if="linePath" :d="linePath" class="balance-line" />

        <!-- Event dots -->
        <circle
          v-for="(dot, i) in eventDots"
          :key="i"
          :cx="dot.x.toFixed(1)"
          :cy="dot.y.toFixed(1)"
          r="4"
          :class="dot.positive ? 'dot-income' : 'dot-expense'"
        />
      </svg>

      <!-- Account list -->
      <div v-if="result.accounts.length" class="account-row">
        <span
          v-for="account in result.accounts"
          :key="account.id"
          class="account-chip"
        >
          {{ account.name }}
          <span class="account-balance">{{ formatCurrency(account.current_balance) }}</span>
        </span>
      </div>
      <p v-else class="no-accounts">
        Add bank accounts and paychecks to see your projected balance.
      </p>
    </div>

    <!-- Event list -->
    <div v-if="groupedEvents.length" class="event-section">
      <h2>Upcoming Events</h2>
      <div class="event-list">
        <div v-for="group in groupedEvents" :key="group.date" class="event-group">
          <div class="event-date-row">
            <span class="event-date">{{ formatDate(group.date) }}</span>
            <span class="event-day-total" :class="group.dayTotal >= 0 ? 'positive' : 'negative'">
              {{ group.dayTotal >= 0 ? '+' : '' }}{{ formatCurrency(group.dayTotal) }}
            </span>
          </div>
          <ul class="event-items">
            <li v-for="(ev, idx) in group.events" :key="idx" class="event-item">
              <span class="event-type-badge" :class="`badge-${ev.type}`">{{ eventLabel(ev.type) }}</span>
              <span class="event-desc">
                {{ ev.description }}
                <span v-if="ev.account_name" class="event-account"> → {{ ev.account_name }}</span>
              </span>
              <span class="event-amount" :class="ev.amount >= 0 ? 'positive' : 'negative'">
                {{ ev.amount >= 0 ? '+' : '' }}{{ formatCurrency(ev.amount) }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <h3>No events projected</h3>
      <p>Add paychecks, debts, or recurring transactions to see your future cash flow.</p>
    </div>
  </template>
</template>

<style scoped>
.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.view-header p {
  margin-top: var(--space-1);
}

.range-picker {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.range-btn {
  font: inherit;
  font-size: 0.85rem;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.range-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.range-btn.active {
  background: var(--color-primary-bg);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

@media (max-width: 640px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.positive {
  color: var(--color-success, #22a06b);
}

.negative {
  color: var(--color-danger, #e34935);
}

.chart-panel {
  padding: var(--space-4);
  margin-bottom: var(--space-5);
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.grid-line {
  stroke: var(--color-border);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.zero-line {
  stroke: var(--color-text-muted);
  stroke-width: 1;
  opacity: 0.4;
}

.axis-label {
  font-size: 11px;
  fill: var(--color-text-muted);
}

.y-label {
  text-anchor: end;
  dominant-baseline: middle;
}

.x-label {
  text-anchor: middle;
  dominant-baseline: hanging;
}

.area-fill {
  fill: var(--color-primary);
  opacity: 0.08;
}

.balance-line {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.dot-income {
  fill: var(--color-success, #22a06b);
  stroke: var(--color-surface);
  stroke-width: 1.5;
}

.dot-expense {
  fill: var(--color-danger, #e34935);
  stroke: var(--color-surface);
  stroke-width: 1.5;
}

.account-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.account-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.8rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
}

.account-balance {
  font-weight: 600;
  color: var(--color-text);
}

.no-accounts {
  margin-top: var(--space-4);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.loading-placeholder {
  height: 420px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-5);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.event-section h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-4);
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.event-group {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.event-date-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.event-date {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.event-day-total {
  font-size: 0.9rem;
  font-weight: 700;
}

.event-items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.event-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.event-item:last-child {
  border-bottom: none;
}

.event-type-badge {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-paycheck {
  background: color-mix(in srgb, var(--color-success, #22a06b) 12%, transparent);
  color: var(--color-success, #22a06b);
}

.badge-debt_payment {
  background: color-mix(in srgb, var(--color-danger, #e34935) 12%, transparent);
  color: var(--color-danger, #e34935);
}

.badge-recurring_transaction {
  background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
  color: var(--color-warning, #f59e0b);
}

.event-desc {
  flex: 1;
  font-size: 0.9rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-account {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.event-amount {
  flex-shrink: 0;
  font-size: 0.9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectedOutflow } from '../types';
import { formatCurrency } from '../utils/format';
import { emojiForOutflow } from '../utils/categoryEmoji';

const props = defineProps<{
  outflows: ProjectedOutflow[];
  from: string;
  to: string;
}>();

// Cap the number of outflow pills shown per day cell — a day with many
// bills (design doc edge case: "a day with many outflows") gets a compact
// "+N more" badge instead of blowing out the cell's height and breaking
// the grid's row alignment.
const MAX_PER_DAY = 3;

interface CalendarDay {
  date: string;
  dayOfMonth: number;
  inRange: boolean;
  outflows: ProjectedOutflow[];
}

// Origin-inspired: outflows plotted on their due date rather than a flat
// chronological list (design doc "Origin's cash flow feature"). Builds a
// Sunday-first week grid spanning the whole [from, to] projection window,
// padding the first/last week with out-of-range days so the 7-column
// layout never breaks — those padding cells render dimmed and empty.
const weeks = computed(() => {
  const byDate = new Map<string, ProjectedOutflow[]>();
  for (const outflow of props.outflows) {
    const bucket = byDate.get(outflow.date);
    if (bucket) bucket.push(outflow);
    else byDate.set(outflow.date, [outflow]);
  }

  // `from`/`to`/outflow dates are plain YYYY-MM-DD calendar dates with no
  // timezone of their own — parsed and manipulated entirely in UTC (Z
  // suffix + UTC getters/setters) so day bucketing can't drift by ±1 for
  // users west of UTC. Mixing local-time parsing with toISOString's UTC
  // formatting was the bug: a local midnight can format as the previous
  // UTC day, mis-assigning outflows to the wrong cell.
  const start = new Date(`${props.from}T00:00:00Z`);
  const end = new Date(`${props.to}T00:00:00Z`);
  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const days: CalendarDay[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      dayOfMonth: d.getUTCDate(),
      inRange: d >= start && d <= end,
      outflows: byDate.get(iso) ?? [],
    });
  }

  const result: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    result.push(days.slice(i, i + 7));
  }
  return result;
});

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayTotal(day: CalendarDay): number {
  return day.outflows.reduce((sum, o) => sum + o.amount, 0);
}
</script>

<template>
  <div class="outflow-calendar">
    <div class="calendar-weekdays">
      <span v-for="label in WEEKDAY_LABELS" :key="label">{{ label }}</span>
    </div>
    <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="calendar-week">
      <div
        v-for="day in week"
        :key="day.date"
        class="calendar-day"
        :class="{ 'out-of-range': !day.inRange, 'has-outflows': day.outflows.length > 0 }"
      >
        <div class="calendar-day-header">
          <span class="calendar-day-number">{{ day.dayOfMonth }}</span>
          <span v-if="day.outflows.length" class="calendar-day-total font-mono">{{ formatCurrency(dayTotal(day)) }}</span>
        </div>
        <div v-if="day.outflows.length" class="calendar-day-pills">
          <span
            v-for="outflow in day.outflows.slice(0, MAX_PER_DAY)"
            :key="`${outflow.source}-${outflow.id}`"
            class="calendar-pill"
            :title="`${outflow.label}: ${formatCurrency(outflow.amount)}`"
          >
            <span aria-hidden="true">{{ emojiForOutflow(outflow.label, outflow.source) }}</span>
            {{ outflow.label }}
          </span>
          <span v-if="day.outflows.length > MAX_PER_DAY" class="calendar-pill-overflow">
            +{{ day.outflows.length - MAX_PER_DAY }} more
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.outflow-calendar {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.calendar-weekdays,
.calendar-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-weekdays {
  margin-bottom: var(--space-2);
}

.calendar-weekdays span {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  text-align: center;
  padding-bottom: var(--space-1);
}

.calendar-day {
  min-height: 84px;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.calendar-day.out-of-range {
  opacity: 0.35;
  border-style: dashed;
}

.calendar-day.has-outflows {
  background: var(--color-surface);
  border-color: var(--color-primary-bg);
}

.calendar-day-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1);
}

.calendar-day-number {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.calendar-day-total {
  font-size: 0.72rem;
  color: var(--color-text);
  font-weight: 600;
}

.calendar-day-pills {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.calendar-pill {
  font-size: 0.7rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-pill-overflow {
  font-size: 0.68rem;
  color: var(--color-text-muted);
}

@media (max-width: 640px) {
  .calendar-weekdays span {
    font-size: 0.62rem;
  }

  .calendar-day {
    min-height: 60px;
    padding: 4px;
  }

  .calendar-day-total,
  .calendar-pill {
    display: none;
  }
}
</style>

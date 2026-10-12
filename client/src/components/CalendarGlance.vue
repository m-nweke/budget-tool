<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { FinanceData } from '../finance/types';
import { calendarEntries, shiftDate } from '../finance/calendar';
import type { CalendarEntry } from '../finance/calendar';
import { buildCalendarWeeks } from '../utils/calendarGrid';
import FinanceIcon from './FinanceIcon.vue';

/** Compact month view that fits the Overview trajectory panel; the Calendar page keeps the full agenda. */
const props = defineProps<{ data: FinanceData }>();
const month = ref(props.data.as_of.slice(0, 7));
const selected = ref(props.data.as_of);
const grid = ref<HTMLElement | null>(null);
const money = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v / 100);
const glyph = (kind: CalendarEntry['kind']) => kind === 'income' ? '+' : kind === 'transfer' ? '↔' : '−';
const from = computed(() => month.value + '-01');
const to = computed(() => new Date(Date.UTC(Number(month.value.slice(0, 4)), Number(month.value.slice(5, 7)), 0, 12)).toISOString().slice(0, 10));
const monthLabel = computed(() => new Date(from.value + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
const weeks = computed(() => buildCalendarWeeks([], from.value, to.value));
const entries = computed(() => calendarEntries(props.data, weeks.value[0]![0]!.date, weeks.value.at(-1)!.at(-1)!.date));
const forDay = (date: string) => entries.value.filter(e => e.date === date);
const day = computed(() => forDay(selected.value));
const totals = computed(() => (['income', 'expense', 'transfer'] as const)
  .map(kind => ({ kind, cents: day.value.filter(e => e.kind === kind).reduce((s, e) => s + e.amount_cents, 0) }))
  .filter(t => t.cents));
const label = (kind: CalendarEntry['kind']) => kind === 'income' ? 'in' : kind === 'transfer' ? 'moved' : 'out';
const selectedLabel = computed(() => new Date(selected.value + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }));
const summary = computed(() => {
  const scheduled = day.value.filter(e => e.status === 'scheduled').length, recorded = day.value.length - scheduled;
  return [scheduled && `${scheduled} scheduled`, recorded && `${recorded} recorded`].filter(Boolean).join(' · ') || 'Nothing planned';
});

function select(date: string) { selected.value = date; month.value = date.slice(0, 7); }
function changeMonth(step: number) {
  const next = new Date(from.value + 'T12:00:00Z'); next.setUTCMonth(next.getUTCMonth() + step);
  month.value = next.toISOString().slice(0, 7);
  selected.value = month.value === props.data.as_of.slice(0, 7) ? props.data.as_of : month.value + '-01';
}
async function move(event: KeyboardEvent, date: string) {
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!(event.key in offsets)) return;
  event.preventDefault(); select(shiftDate(date, offsets[event.key]!));
  await nextTick(); grid.value?.querySelector<HTMLButtonElement>(`[data-date="${selected.value}"]`)?.focus();
}
function dayLabel(date: string) {
  const items = forDay(date);
  const text = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  return `${text}${date === props.data.as_of ? ', today' : ''}${items.length ? ': ' + items.map(e => `${e.status} ${e.name} ${glyph(e.kind)}${money(e.amount_cents)}`).join(', ') : ', no entries'}`;
}
</script>

<template>
  <div class="glance">
    <div class="trajectory-readout glance-readout">
      <div aria-live="polite">
        <span class="subtle">{{ selectedLabel }} · {{ summary }}</span>
        <div class="glance-totals">
          <strong v-for="t in totals" :key="t.kind" :class="t.kind">{{ glyph(t.kind) }}{{ money(t.cents) }} <small>{{ label(t.kind) }}</small></strong>
          <strong v-if="!totals.length" class="quiet">A quiet day</strong>
        </div>
      </div>
      <div class="glance-month"><button class="icon-button previous-month" aria-label="Previous month" @click="changeMonth(-1)"><FinanceIcon name="arrow" /></button><span>{{ monthLabel }}</span><button class="icon-button" aria-label="Next month" @click="changeMonth(1)"><FinanceIcon name="arrow" /></button></div>
    </div>
    <div ref="grid" class="glance-grid" role="group" :aria-label="`${monthLabel} money calendar`">
      <span v-for="(d, i) in ['S','M','T','W','T','F','S']" :key="i" class="glance-weekday" aria-hidden="true">{{ d }}</span>
      <template v-for="week in weeks" :key="week[0]!.date">
        <button v-for="d in week" :key="d.date" :data-date="d.date" class="glance-day" :class="{ outside: !d.inRange, selected: selected === d.date, today: d.date === data.as_of }"
          :aria-label="dayLabel(d.date)" :aria-pressed="selected === d.date" :tabindex="selected === d.date ? 0 : -1" @click="select(d.date)" @keydown="move($event, d.date)">
          <span class="glance-number">{{ d.dayOfMonth }}</span>
          <span class="glance-marks" aria-hidden="true"><span v-for="e in forDay(d.date).slice(0, 3)" :key="e.id" :class="[e.kind, { recorded: e.status === 'recorded' }]">{{ glyph(e.kind) }}</span></span>
        </button>
      </template>
    </div>
    <div class="chart-dates glance-legend" aria-hidden="true"><span><b class="income">+</b> Money in</span><span><b class="expense">−</b> Money out</span><span><b class="transfer">↔</b> Transfer</span><span><b class="mark-sample">+</b> Scheduled <b class="mark-sample recorded">+</b> Recorded</span></div>
  </div>
</template>

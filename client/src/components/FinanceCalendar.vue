<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { FinanceData } from '../finance/types';
import { calendarEntries, shiftDate } from '../finance/calendar';
import { buildCalendarWeeks } from '../utils/calendarGrid';
import FinanceIcon from './FinanceIcon.vue';
const props = defineProps<{ data: FinanceData }>();
const emit = defineEmits<{ activity: [date: string]; commitment: [date: string] }>();
const month = ref(props.data.as_of.slice(0, 7));
const selected = ref(props.data.as_of);
const filter = ref('all');
const calendar = ref<HTMLElement | null>(null);
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value / 100);
const from = computed(() => month.value + '-01');
const to = computed(() => new Date(Date.UTC(Number(month.value.slice(0, 4)), Number(month.value.slice(5, 7)), 0, 12)).toISOString().slice(0, 10));
const monthLabel = computed(() => new Date(from.value + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
const selectedLabel = computed(() => new Date(selected.value + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }));
const weeks = computed(() => buildCalendarWeeks([], from.value, to.value));
const entries = computed(() => calendarEntries(props.data, weeks.value[0]![0]!.date, weeks.value.at(-1)!.at(-1)!.date));
const visible = computed(() => entries.value.filter(e => filter.value === 'all' || e.status === filter.value));
const forDay = (date: string) => visible.value.filter(e => e.date === date);
const selectedEntries = computed(() => forDay(selected.value));
const scheduled = computed(() => entries.value.filter(e => e.status === 'scheduled' && e.date >= from.value && e.date <= to.value));
const incoming = computed(() => scheduled.value.filter(e => e.kind === 'income').reduce((sum, e) => sum + e.amount_cents, 0));
const outgoing = computed(() => scheduled.value.filter(e => e.kind === 'expense').reduce((sum, e) => sum + e.amount_cents, 0));
const transfers = computed(() => scheduled.value.filter(e => e.kind === 'transfer').reduce((sum, e) => sum + e.amount_cents, 0));
const direction = (kind: string) => kind === 'income' ? 'Money in' : kind === 'transfer' ? 'Transfer' : 'Money out';
const signed = (kind: string, amount: number) => `${kind === 'income' ? '+' : kind === 'transfer' ? '↔ ' : '−'}${money(amount)}`;
const projected = computed(() => props.data.forecast.daily.find(day => day.date === selected.value));
function changeMonth(direction: number) {
  const next = new Date(from.value + 'T12:00:00Z'); next.setUTCMonth(next.getUTCMonth() + direction);
  month.value = next.toISOString().slice(0, 7); selected.value = month.value === props.data.as_of.slice(0, 7) ? props.data.as_of : month.value + '-01';
}
function today() { month.value = props.data.as_of.slice(0, 7); selected.value = props.data.as_of; }
async function moveSelection(event: KeyboardEvent, date: string) {
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!(event.key in offsets)) return;
  event.preventDefault(); selected.value = shiftDate(date, offsets[event.key]!); month.value = selected.value.slice(0, 7);
  await nextTick(); calendar.value?.querySelector<HTMLButtonElement>(`[data-date="${selected.value}"]`)?.focus();
}
function select(date: string) { selected.value = date; if (!date.startsWith(month.value)) month.value = date.slice(0, 7); }
function dayLabel(date: string) {
  const label = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const day = forDay(date); return `${label}${date === props.data.as_of ? ', today' : ''}, ${day.length} ${day.length === 1 ? 'entry' : 'entries'}${day.length ? ': ' + day.map(e => `${e.status} ${direction(e.kind)} ${signed(e.kind, e.amount_cents)}`).join(', ') : ''}`;
}
</script>
<template>
  <div class="money-calendar">
    <div class="calendar-toolbar"><div class="calendar-month-control"><h2 aria-live="polite">{{ monthLabel }}</h2><button class="icon-button previous-month" aria-label="Previous month" @click="changeMonth(-1)"><FinanceIcon name="arrow"/></button><button class="icon-button" aria-label="Next month" @click="changeMonth(1)"><FinanceIcon name="arrow"/></button><button class="text-button" @click="today">Today</button></div><label class="calendar-filter"><span class="sr-only">Calendar entries</span><select v-model="filter"><option value="all">All entries</option><option value="scheduled">Scheduled only</option><option value="recorded">Recorded only</option></select></label></div>
    <section class="calendar-month-summary" aria-label="Scheduled this month"><p class="page-kicker">Scheduled this month</p><div class="calendar-summary-cards"><article class="calendar-summary-card income"><span><i class="calendar-legend-dot income"/> Money in</span><strong>+{{ money(incoming) }}</strong><small>Expected deposits</small></article><article class="calendar-summary-card expense"><span><i class="calendar-legend-dot expense"/> Money out</span><strong>−{{ money(outgoing) }}</strong><small>Planned spending & payments</small></article><article class="calendar-summary-card transfer"><span><i class="calendar-legend-dot transfer"/> Transfers</span><strong>↔ {{ money(transfers) }}</strong><small>Between your accounts</small></article></div></section>
    <div class="calendar-layout">
      <section ref="calendar" class="calendar-month" aria-label="Monthly money calendar">
        <div class="money-weekdays" aria-hidden="true"><span v-for="day in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="day">{{ day }}</span></div>
        <div v-for="(week, index) in weeks" :key="index" class="money-week">
          <button v-for="day in week" :key="day.date" :data-date="day.date" class="money-day" :class="{outside: !day.inRange, selected: selected === day.date, today: day.date === data.as_of}" :aria-label="dayLabel(day.date)" :aria-pressed="selected === day.date" :aria-current="day.date === data.as_of ? 'date' : undefined" :tabindex="selected === day.date ? 0 : -1" @click="select(day.date)" @keydown="moveSelection($event, day.date)">
            <span class="money-day-number">{{ day.dayOfMonth }}</span>
            <span class="day-entry-list" aria-hidden="true"><span v-for="entry in forDay(day.date).slice(0, 2)" :key="entry.id" class="day-entry" :class="entry.kind"><i :class="{recorded: entry.status === 'recorded'}"/><span>{{ entry.name }}</span><b>{{ signed(entry.kind, entry.amount_cents) }}</b></span><span v-if="forDay(day.date).length > 2" class="day-more">+{{ forDay(day.date).length - 2 }} more</span></span>
            <span class="mobile-day-dots" aria-hidden="true"><span v-for="entry in forDay(day.date).slice(0, 3)" :key="entry.id" :class="entry.kind">{{ entry.kind === 'income' ? '+' : entry.kind === 'transfer' ? '↔' : '−' }}<i :class="{recorded: entry.status === 'recorded'}"/></span></span>
          </button>
        </div>
        <div class="calendar-legend"><span><i class="calendar-legend-dot income"/> + Money in</span><span><i class="calendar-legend-dot expense"/> − Money out</span><span><i class="calendar-legend-dot transfer"/> ↔ Transfer</span><span><i class="calendar-status-mark"/> Scheduled <i class="calendar-status-mark recorded"/> Recorded</span><small>Choose a day to see the details</small></div>
      </section>
      <aside class="calendar-agenda" aria-label="Selected day details" aria-live="polite"><p class="page-kicker">{{ selected === data.as_of ? 'Today’s picture' : 'A closer look' }}</p><h2>{{ selectedLabel }}</h2><div v-if="projected" class="day-projection"><span>Projected spending cash</span><strong>{{ money(projected.balance_cents) }}</strong></div><p v-else class="calendar-outlook-note">{{ selected < data.as_of ? 'Recorded activity and scheduled commitments for this day.' : 'Cash projections are available within your 90-day outlook.' }}</p>
        <div v-for="entry in selectedEntries" :key="entry.id" class="agenda-entry"><span class="activity-symbol" :class="entry.kind"><FinanceIcon :name="entry.kind === 'income' ? 'forecast' : entry.kind === 'transfer' ? 'arrow' : 'activity'"/></span><div><strong>{{ entry.name }}</strong><small>{{ data.accounts.find(a => a.id === entry.account_id)?.name ?? 'Account needed' }}<template v-if="entry.kind === 'transfer' && entry.transfer_account_id"> → {{ data.accounts.find(a => a.id === entry.transfer_account_id)?.name ?? 'Account needed' }}</template></small><span class="agenda-status">{{ entry.status === 'recorded' ? 'Recorded' : entry.date < data.as_of ? 'Past scheduled date' : 'Scheduled' }}</span></div><div class="agenda-money" :class="entry.kind"><span>{{ direction(entry.kind) }}</span><b>{{ signed(entry.kind, entry.amount_cents) }}</b></div></div>
        <div v-if="!selectedEntries.length" class="agenda-empty"><FinanceIcon name="calendar"/><h3>A little breathing room.</h3><p>{{ filter === 'all' ? 'No entries for this day.' : 'No entries match this filter.' }}</p></div>
        <div class="agenda-actions"><button class="btn btn-secondary" @click="emit('commitment', selected)"><FinanceIcon name="plus"/> Plan a commitment</button><button class="text-button" :disabled="selected > data.as_of" @click="emit('activity', selected)">Record activity <FinanceIcon name="arrow"/></button><small v-if="selected > data.as_of" class="subtle">Future payments can be planned as commitments.</small></div>
      </aside>
    </div>
    <p class="calendar-note">Scheduled entries are plans, not confirmed payments. Recorded activity appears separately; payments linked to a commitment reduce its remaining amount.</p>
  </div>
</template>

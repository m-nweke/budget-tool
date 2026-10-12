import { reactive } from 'vue';

export type TourMode = 'demo' | 'personal';
export interface TourStep { section: 'overview' | 'calendar' | 'forecast' | 'plans'; target: string; title: string; body: string }

/** One walkthrough for both the demo and a real workspace, since they share the same interface. */
export const tourSteps: TourStep[] = [
  { section: 'overview', target: '.spend-panel', title: 'Start with safe to spend',
    body: 'This is the least room you’ll have before your next deposit, after scheduled bills, protected goals, your cushion and an everyday allowance. “How this is calculated” shows each deduction.' },
  { section: 'overview', target: '.trajectory-panel', title: 'Trajectory or calendar',
    body: 'Switch this panel between your 90-day cash line and a month at a glance. Choose a day to see what goes in (+), out (−) or between your accounts (↔).' },
  { section: 'calendar', target: '.money-calendar', title: 'Every day, signed',
    body: 'Hollow dots are plans and filled dots have already happened; every amount carries its sign. Payments you link to a plan reduce what’s left on it. Use the arrow keys to move between days.' },
  { section: 'forecast', target: '.what-if-panel', title: 'Try a what-if',
    body: 'Add an expense or income on any day to see how your line moves. Scenarios are temporary; your accounts and plans stay exactly as they are.' },
  { section: 'plans', target: '.vaults-section', title: 'Vaults, with a review step',
    body: 'Give savings a purpose and suggest a share of each deposit. You always review suggestions first, and nothing moves money between banks.' },
];

export const tour = reactive({ active: false, index: 0, mode: 'demo' as TourMode });
const seenKey = (mode: TourMode) => `finance-tour-seen:${mode}`;

export function tourSeen(mode: TourMode): boolean {
  try { return localStorage.getItem(seenKey(mode)) === '1'; } catch { return true; }
}
export function startTour(mode: TourMode) { tour.mode = mode; tour.index = 0; tour.active = true; }
export function endTour() {
  tour.active = false;
  try { localStorage.setItem(seenKey(tour.mode), '1'); } catch { /* storage unavailable: the tour may show again */ }
}
/** First visit only: the demo always qualifies; a real workspace waits until it has an account to point at. */
export function maybeAutoStart(mode: TourMode, hasAccounts: boolean) {
  if (!tour.active && !tourSeen(mode) && (mode === 'demo' || hasAccounts)) startTour(mode);
}

// Converts a page's raw API data into the generic shape PageSnapshot.vue
// renders. Called from both that page's own view (atop its list) and the
// Dashboard (aggregated) — the conversion logic exists exactly once per
// page, so a page's snapshot only ever needs to be defined here. Future
// pages (Goals, Bills, Accounts, Paycheck, Cash Flow) add their own
// buildXSnapshot function to this file following the same shape.
import { formatCurrency } from './format';
import type { DebtPayoffPlanResponse } from '../types';

export interface PageSnapshotStat {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'warning' | 'success';
}

export interface PageSnapshotProps {
  title: string;
  to: string;
  stats: PageSnapshotStat[];
}

export function buildDebtSnapshot(plan: DebtPayoffPlanResponse): PageSnapshotProps | null {
  if (!plan.snapshot) return null;
  const { highest_interest, lowest_balance, soonest_due } = plan.snapshot;
  return {
    title: 'Debts',
    to: '/debts',
    stats: [
      { label: 'Highest interest', value: `${highest_interest.name} — ${highest_interest.interest_rate}%`, tone: 'danger' },
      { label: 'Lowest balance', value: `${lowest_balance.name} — ${formatCurrency(lowest_balance.balance)}` },
      { label: 'Due soonest', value: `${soonest_due.name} — ${soonest_due.due_date}`, tone: 'warning' },
    ],
  };
}

<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '../api';
import GoalForm from '../components/GoalForm.vue';
import BankLogo from '../components/BankLogo.vue';
import KebabMenu from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useCrudListView } from '../composables/useCrudListView';
import { formatCurrency, accountLabel } from '../utils/format';
import type { SavingsGoal, CreateSavingsGoalDto, BankAccount } from '../types';

type Interval = 'week' | 'month' | 'quarter';

const accounts = ref<BankAccount[]>([]);
const interval = ref<Interval>('month');

const {
  items: goals,
  showForm,
  editingItem: editingGoal,
  formReadonly,
  error,
  loaded,
  viewTop,
  openCreateForm,
  openEditForm,
  openViewForm,
  closeForm,
  handleSubmit,
  pendingDelete,
  requestDelete,
  cancelDelete,
  confirmDelete,
} = useCrudListView<SavingsGoal, CreateSavingsGoalDto>(
  async () => {
    const [goalsResult, accountsResult] = await Promise.all([api.getSavingsGoals(), api.getBankAccounts()]);
    accounts.value = accountsResult;
    return goalsResult;
  },
  { create: api.createSavingsGoal, update: api.updateSavingsGoal, remove: api.deleteSavingsGoal }
);

const accountNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const account of accounts.value) {
    map[account.id] = accountLabel(account);
  }
  return map;
});

const accountInstitutionById = computed(() => {
  const map: Record<number, string | null> = {};
  for (const account of accounts.value) {
    map[account.id] = account.institution;
  }
  return map;
});

const INTERVAL_LABELS: Record<Interval, string> = { week: 'week', month: 'month', quarter: 'quarter' };
// Average days per interval — a week is exact, month/quarter are averages
// (365.25 / 12 and / 4) since neither divides a calendar evenly, same
// tradeoff the server's PERIODS_PER_MONTH-style proration makes elsewhere.
const DAYS_PER_INTERVAL: Record<Interval, number> = { week: 7, month: 365.25 / 12, quarter: 365.25 / 4 };

function progressFor(goal: SavingsGoal): number {
  if (goal.target_amount <= 0) return 0;
  return Math.min(1, Math.max(0, goal.saved_amount / goal.target_amount));
}

// Same 3-tier percentage-based coloring as DashboardView's budget usage bar
// (level-low/medium/high), but inverted: there, high % means "over budget,
// bad." Here, high % means "close to the goal, great" — so the color
// progression runs warning (early, needs momentum) -> primary (steady) ->
// success (almost there), not success -> warning -> danger.
function progressLevel(goal: SavingsGoal): 'low' | 'medium' | 'high' {
  const pct = progressFor(goal) * 100;
  if (pct >= 75) return 'high';
  if (pct >= 40) return 'medium';
  return 'low';
}

// A stable per-account color so every goal vaulted into the same account
// shows a matching badge at a glance — hashed by account id into a fixed
// hue palette rather than computed from the name (two accounts can share a
// name, see accountLabel), and rendered as a translucent hsl() tint so it
// reads correctly over both the light and dark surface color without a
// separate dark-mode palette.
const ACCOUNT_HUES = [210, 150, 280, 25, 340, 190, 60, 320];
function accountBadgeStyle(accountId: number) {
  const hue = ACCOUNT_HUES[accountId % ACCOUNT_HUES.length];
  return {
    color: `hsl(${hue} 70% 40%)`,
    background: `hsl(${hue} 70% 45% / 0.15)`,
    border: `1px solid hsl(${hue} 70% 45% / 0.35)`,
  };
}

// When a goal has no target_date, there's nothing for paceFor to compute a
// per-interval number against — but "no deadline" shouldn't mean "no sense
// of pace" either. Projects a default end-of-year target date instead, so
// the goal still shows a concrete "save $X/interval" number rather than
// silently falling through to the plain "on track" state.
function endOfYearISO(): string {
  return `${new Date().getFullYear()}-12-31`;
}

// How much to set aside each `interval` to hit target_date, based on what's
// left to save today. Returns null only when the goal is already fully
// funded, so the template can show a plain "on track" state — a missing
// target_date no longer suppresses this: it falls back to endOfYearISO()
// so there's always a concrete pace to show (see effectiveTargetDate).
function paceFor(goal: SavingsGoal): number | null {
  const remaining = goal.target_amount - goal.saved_amount;
  if (remaining <= 0) return null;
  const daysLeft = (new Date(effectiveTargetDate(goal)).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const periodsLeft = Math.max(1, daysLeft / DAYS_PER_INTERVAL[interval.value]);
  return remaining / periodsLeft;
}

function effectiveTargetDate(goal: SavingsGoal): string {
  return goal.target_date ?? endOfYearISO();
}

</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Goals</h1>
      <p>Save toward a target amount, optionally as a vault of a linked account.</p>
    </div>
    <div class="header-actions">
      <div v-if="goals.length" class="interval-toggle">
        <button
          v-for="option in (['week', 'month', 'quarter'] as Interval[])"
          :key="option"
          type="button"
          class="interval-option"
          :class="{ active: interval === option }"
          @click="interval = option"
        >
          Per {{ option }}
        </button>
      </div>
      <button v-if="!showForm && goals.length" class="btn btn-primary" @click="openCreateForm">+ Add Goal</button>
    </div>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ !editingGoal ? 'New Goal' : formReadonly ? 'View Goal' : 'Edit Goal' }}</h2>
    <GoalForm
      :goal="editingGoal"
      :readonly="formReadonly"
      @submit="handleSubmit"
      @cancel="closeForm"
      @edit="formReadonly = false"
    />
  </div>

  <div v-if="loaded && !goals.length && !showForm" class="empty-state">
    <h3>No savings goals yet</h3>
    <p>Set a target amount to start tracking progress toward it.</p>
    <button class="btn btn-primary" @click="openCreateForm">Create your first goal</button>
  </div>

  <ul v-else class="goal-list">
    <li v-for="goal in goals" :key="goal.id" class="card goal-row clickable" @click="openViewForm(goal)">
      <div class="goal-body">
        <div class="goal-name">
          <span class="goal-emoji" aria-hidden="true">🎯</span>
          {{ goal.name }}
          <span v-if="goal.bank_account_id" class="badge vault-badge" :style="accountBadgeStyle(goal.bank_account_id)">
            <BankLogo :institution="accountInstitutionById[goal.bank_account_id] ?? null" size="1.25rem" />
            Vault of {{ accountNameById[goal.bank_account_id] }}
          </span>
        </div>
        <div class="goal-amount">
          <span class="font-mono">{{ formatCurrency(goal.saved_amount) }}</span> of <span class="font-mono">{{ formatCurrency(goal.target_amount) }}</span> saved
          <span v-if="goal.target_date"> · target {{ goal.target_date }}</span>
          <span v-else> · projected end-of-year target {{ endOfYearISO() }}</span>
        </div>
        <div class="progress-track" :title="`${Math.round(progressFor(goal) * 100)}% saved`">
          <div class="progress-fill" :class="`level-${progressLevel(goal)}`" :style="{ width: `${progressFor(goal) * 100}%` }" />
        </div>
        <div v-if="paceFor(goal) !== null" class="goal-pace">
          Save {{ formatCurrency(paceFor(goal)!) }} per {{ INTERVAL_LABELS[interval] }} to hit
          {{ goal.target_date ? 'your target date' : `the projected ${endOfYearISO()} date` }}
        </div>
        <div v-else-if="progressFor(goal) >= 1" class="goal-pace goal-pace-done">Goal reached</div>
      </div>
      <KebabMenu @click.stop>
        <button type="button" @click="openEditForm(goal)">Edit</button>
        <button type="button" class="danger" @click="requestDelete(goal)">Delete</button>
      </KebabMenu>
    </li>
  </ul>

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete goal?"
    :message="`This will permanently delete '${pendingDelete?.name}'. This can't be undone.`"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
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

.form-panel {
  margin-bottom: var(--space-5);
}

.form-panel h2 {
  margin-bottom: var(--space-4);
}

.goal-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.interval-toggle {
  display: inline-flex;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.interval-option {
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: none;
  padding: 6px 10px;
  border-radius: calc(var(--radius-sm) - 2px);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.interval-option.active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.goal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  gap: var(--space-4);
}

.goal-emoji {
  font-size: 1.05em;
  margin-right: var(--space-1);
}

.goal-row.clickable {
  cursor: pointer;
}

.goal-row.clickable:hover {
  border-color: var(--color-primary);
}

.goal-body {
  flex: 1;
  min-width: 0;
}

.goal-name {
  font-weight: 600;
}

.vault-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.goal-amount {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.progress-track {
  margin-top: var(--space-3);
  height: 6px;
  border-radius: 999px;
  background: var(--color-bg);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease-out, background-color 0.2s;
}

.progress-fill.level-low {
  background: var(--color-warning);
}

.progress-fill.level-medium {
  background: var(--color-primary);
}

.progress-fill.level-high {
  background: var(--color-success);
}

.goal-pace {
  margin-top: var(--space-2);
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.goal-pace-done {
  color: var(--color-success);
  font-weight: 600;
}
</style>

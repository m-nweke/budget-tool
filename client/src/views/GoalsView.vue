<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import GoalForm from '../components/GoalForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useConfirmDelete } from '../composables/useConfirmDelete';
import { formatCurrency } from '../utils/format';
import type { SavingsGoal, CreateSavingsGoalDto, BankAccount } from '../types';

type Interval = 'week' | 'month' | 'quarter';

const goals = ref<SavingsGoal[]>([]);
const accounts = ref<BankAccount[]>([]);
const showForm = ref(false);
const editingGoal = ref<SavingsGoal | null>(null);
const formReadonly = ref(false);
const error = ref('');
const loaded = ref(false);
const viewTop = ref<HTMLElement | null>(null);
const interval = ref<Interval>('month');

const accountNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const account of accounts.value) {
    map[account.id] = account.name;
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

// How much to set aside each `interval` to hit target_date, based on what's
// left to save today. Returns null when there's nothing to compute (no
// target date, or the goal is already fully funded) so the template can
// show a plain "on track" state instead of a pace.
function paceFor(goal: SavingsGoal): number | null {
  const remaining = goal.target_amount - goal.saved_amount;
  if (remaining <= 0 || !goal.target_date) return null;
  const daysLeft = (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const periodsLeft = Math.max(1, daysLeft / DAYS_PER_INTERVAL[interval.value]);
  return remaining / periodsLeft;
}

function scrollToForm() {
  viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadGoals() {
  [goals.value, accounts.value] = await Promise.all([api.getSavingsGoals(), api.getBankAccounts()]);
  loaded.value = true;
}

function openCreateForm() {
  editingGoal.value = null;
  formReadonly.value = false;
  showForm.value = true;
  scrollToForm();
}

function openEditForm(goal: SavingsGoal) {
  editingGoal.value = goal;
  formReadonly.value = false;
  showForm.value = true;
  scrollToForm();
}

function openViewForm(goal: SavingsGoal) {
  editingGoal.value = goal;
  formReadonly.value = true;
  showForm.value = true;
  scrollToForm();
}

function closeForm() {
  showForm.value = false;
  editingGoal.value = null;
}

async function handleSubmit(data: CreateSavingsGoalDto) {
  error.value = '';
  try {
    if (editingGoal.value) {
      await api.updateSavingsGoal(editingGoal.value.id, data);
    } else {
      await api.createSavingsGoal(data);
    }
    closeForm();
    await loadGoals();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleDelete(goal: SavingsGoal) {
  error.value = '';
  try {
    await api.deleteSavingsGoal(goal.id);
    await loadGoals();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

const { pending: pendingDelete, requestDelete, cancel: cancelDelete, confirm: confirmDelete } =
  useConfirmDelete(handleDelete);

onMounted(loadGoals);
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
          {{ goal.name }}
          <span v-if="goal.bank_account_id" class="badge badge-department">
            Vault of {{ accountNameById[goal.bank_account_id] }}
          </span>
        </div>
        <div class="goal-amount">
          {{ formatCurrency(goal.saved_amount) }} of {{ formatCurrency(goal.target_amount) }} saved
          <span v-if="goal.target_date"> · target {{ goal.target_date }}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${progressFor(goal) * 100}%` }" />
        </div>
        <div v-if="paceFor(goal) !== null" class="goal-pace">
          Save {{ formatCurrency(paceFor(goal)!) }} per {{ INTERVAL_LABELS[interval] }} to hit your target date
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
  padding: var(--space-4);
  gap: var(--space-4);
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
  background: var(--color-primary);
  border-radius: 999px;
  transition: width 0.25s ease-out;
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

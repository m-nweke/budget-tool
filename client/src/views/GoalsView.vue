<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import GoalForm from '../components/GoalForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import { formatCurrency } from '../utils/format';
import type { SavingsGoal, CreateSavingsGoalDto, BankAccount } from '../types';

const goals = ref<SavingsGoal[]>([]);
const accounts = ref<BankAccount[]>([]);
const showForm = ref(false);
const editingGoal = ref<SavingsGoal | null>(null);
const error = ref('');
const loaded = ref(false);
const viewTop = ref<HTMLElement | null>(null);

const accountNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const account of accounts.value) {
    map[account.id] = account.name;
  }
  return map;
});

function scrollToForm() {
  viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadGoals() {
  [goals.value, accounts.value] = await Promise.all([api.getSavingsGoals(), api.getBankAccounts()]);
  loaded.value = true;
}

function openCreateForm() {
  editingGoal.value = null;
  showForm.value = true;
  scrollToForm();
}

function openEditForm(goal: SavingsGoal) {
  editingGoal.value = goal;
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

onMounted(loadGoals);
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Goals</h1>
      <p>Save toward a target amount, optionally linked to an account.</p>
    </div>
    <button v-if="!showForm && goals.length" class="btn btn-primary" @click="openCreateForm">+ Add Goal</button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ editingGoal ? 'Edit Goal' : 'New Goal' }}</h2>
    <GoalForm :goal="editingGoal" @submit="handleSubmit" @cancel="closeForm" />
  </div>

  <div v-if="loaded && !goals.length && !showForm" class="empty-state">
    <h3>No savings goals yet</h3>
    <p>Set a target amount to start tracking progress toward it.</p>
    <button class="btn btn-primary" @click="openCreateForm">Create your first goal</button>
  </div>

  <ul v-else class="goal-list">
    <li v-for="goal in goals" :key="goal.id" class="card goal-row">
      <div>
        <div class="goal-name">
          {{ goal.name }}
          <span v-if="goal.bank_account_id" class="badge badge-department">
            {{ accountNameById[goal.bank_account_id] }}
          </span>
        </div>
        <div class="goal-amount">
          {{ formatCurrency(goal.target_amount) }} target<span v-if="goal.target_date"> by {{ goal.target_date }}</span>
        </div>
      </div>
      <KebabMenu>
        <button type="button" @click="openEditForm(goal)">Edit</button>
        <button type="button" class="danger" @click="handleDelete(goal)">Delete</button>
      </KebabMenu>
    </li>
  </ul>
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

.goal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
}

.goal-name {
  font-weight: 600;
}

.goal-amount {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

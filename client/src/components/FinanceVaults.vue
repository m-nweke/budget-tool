<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FinanceData, FinanceGoal } from '../finance/types';
import { demoVaultRules } from '../finance/useFinance';
import type { DemoVaultRule } from '../finance/useFinance';
import FinanceIcon from './FinanceIcon.vue';

const props = defineProps<{ data: FinanceData; demo: boolean }>();
const emit = defineEmits<{ saveGoal: [goal: FinanceGoal] }>();
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const rules = demoVaultRules;
const editing = ref<number | 'new' | null>(null);
const name = ref('');
const accountId = ref<number | null>(null);
const target = ref('');
const targetDate = ref('');
const ruleMode = ref<DemoVaultRule['mode']>('none');
const ruleValue = ref('');
const ruleAccountId = ref<number | null>(null);
const formError = ref('');
const depositAccountId = ref<number | null>(null);
const depositAmount = ref('3250');
const draft = reactive<Record<number, string>>({});
const reviewStatus = ref('');
const reviewError = ref('');
const accountName = (id: number | null) => props.data.accounts.find(account => account.id === id)?.name ?? 'No account linked';
const depositCents = computed(() => Math.round(Number(depositAmount.value) * 100));
const eligible = computed(() => props.data.goals.filter(goal => {
  const rule = rules[goal.id];
  return rule && rule.mode !== 'none' && rule.accountId === depositAccountId.value;
}));
const allocated = computed(() => eligible.value.reduce((sum, goal) => sum + Math.round(Number(draft[goal.id] ?? 0) * 100), 0));
const remaining = computed(() => depositCents.value - allocated.value);
watch(() => props.data.accounts, accounts => {
  if (depositAccountId.value === null) depositAccountId.value = accounts.find(account => account.type === 'checking')?.id ?? accounts[0]?.id ?? null;
}, { immediate: true });
watch(() => eligible.value.map(goal => goal.id).join(','), () => suggest(), { immediate: true });

function edit(goal?: FinanceGoal) {
  if (!props.demo) return;
  editing.value = goal?.id ?? 'new';
  name.value = goal?.name ?? '';
  accountId.value = goal?.account_id ?? null;
  target.value = goal ? String(goal.target_cents / 100) : '';
  targetDate.value = goal?.target_date ?? '';
  const rule = goal ? rules[goal.id] : undefined;
  ruleMode.value = rule?.mode ?? 'none';
  ruleValue.value = rule ? String(rule.value) : '';
  ruleAccountId.value = rule?.accountId ?? null;
  formError.value = '';
}
function save() {
  const targetCents = Math.round(Number(target.value) * 100);
  const value = Number(ruleValue.value);
  if (!name.value.trim() || !Number.isSafeInteger(targetCents) || targetCents <= 0) {
    formError.value = 'Enter a name and a goal amount greater than zero.'; return;
  }
  if (ruleMode.value !== 'none' && (!ruleAccountId.value || !Number.isFinite(value) || value <= 0 || (ruleMode.value === 'percent' && value > 100))) {
    formError.value = 'Choose a receiving account and a valid allocation amount.'; return;
  }
  if (editing.value === 'new') {
    const id = Math.max(0, ...props.data.goals.map(goal => goal.id)) + 1;
    emit('saveGoal', { id, name: name.value.trim(), account_id: accountId.value, target_cents: targetCents, saved_cents: 0, target_date: targetDate.value || null });
    rules[id] = { mode: ruleMode.value, value, accountId: ruleAccountId.value };
  } else if (typeof editing.value === 'number') {
    const goal = props.data.goals.find(item => item.id === editing.value);
    if (goal) emit('saveGoal', { ...goal, name: name.value.trim(), account_id: accountId.value, target_cents: targetCents, target_date: targetDate.value || null });
    rules[editing.value] = { mode: ruleMode.value, value, accountId: ruleAccountId.value };
  }
  editing.value = null;
  reviewStatus.value = 'Vault preview updated in this demo.';
  suggest();
}
function suggest() {
  reviewError.value = '';
  reviewStatus.value = '';
  for (const id of Object.keys(draft)) delete draft[Number(id)];
  if (!Number.isSafeInteger(depositCents.value) || depositCents.value <= 0) return;
  let available = depositCents.value;
  for (const goal of eligible.value) {
    const rule = rules[goal.id]!;
    const desired = rule.mode === 'percent' ? Math.floor(depositCents.value * rule.value / 100) : Math.round(rule.value * 100);
    const amount = Math.max(0, Math.min(desired, available, Math.max(0, goal.target_cents - goal.saved_cents)));
    draft[goal.id] = (amount / 100).toFixed(2);
    available -= amount;
  }
}
function confirmReview() {
  if (!Number.isSafeInteger(depositCents.value) || depositCents.value <= 0) {
    reviewError.value = 'Enter a deposit greater than zero.'; return;
  }
  if (eligible.value.some(goal => !Number.isFinite(Number(draft[goal.id])) || Number(draft[goal.id]) < 0) || remaining.value < 0) {
    reviewError.value = 'Allocations must be positive and cannot exceed the deposit.'; return;
  }
  reviewError.value = '';
  reviewStatus.value = `${money(allocated.value)} reviewed for ${eligible.value.length} vaults. Preview only; no balances or transfers changed.`;
}
function skipReview() {
  for (const id of Object.keys(draft)) draft[Number(id)] = '0.00';
  reviewError.value = '';
  reviewStatus.value = 'Suggestions skipped. No balances or transfers changed.';
}
</script>

<template>
  <section class="vaults-section" aria-labelledby="vaults-title">
    <div class="section-heading vaults-heading"><div><p class="page-kicker">Put money aside with intention</p><h2 id="vaults-title">Your vaults</h2></div><button v-if="demo" class="btn btn-secondary" @click="edit()"><FinanceIcon name="plus"/> New vault</button><RouterLink v-else to="/goals" class="btn btn-secondary"><FinanceIcon name="plus"/> Manage vaults</RouterLink></div>
    <p class="vaults-intro">Vaults give your savings a purpose. A linked account is one you track in Budget Tool; it is not a bank connection.</p>
    <div v-if="data.goals.length" class="vault-grid">
      <article v-for="goal in data.goals" :key="goal.id" class="vault-card">
        <div class="vault-card-top"><span class="vault-mark" aria-hidden="true">◈</span><span class="vault-account">{{ accountName(goal.account_id) }}</span></div>
        <h3>{{ goal.name }}</h3><div class="vault-amount">{{ money(goal.saved_cents) }}</div><p class="vault-target">Set aside of {{ money(goal.target_cents) }}<template v-if="goal.target_date"> · by {{ goal.target_date }}</template></p>
        <progress :value="Math.min(goal.saved_cents, goal.target_cents)" :max="goal.target_cents" :aria-label="`${goal.name} progress`"/>
        <div class="vault-card-bottom"><span>{{ Math.round(goal.saved_cents / goal.target_cents * 100) }}% of goal</span><button v-if="demo" class="text-button" :aria-label="`Edit ${goal.name} vault preview`" @click="edit(goal)">Edit preview <FinanceIcon name="arrow"/></button><RouterLink v-else to="/goals" class="text-button">Manage goal <FinanceIcon name="arrow"/></RouterLink></div>
        <p v-if="demo" class="vault-rule">{{ rules[goal.id]?.mode === 'percent' ? `${rules[goal.id]?.value}% of deposits into ${accountName(rules[goal.id]?.accountId ?? null)}` : rules[goal.id]?.mode === 'fixed' ? `${money(Math.round((rules[goal.id]?.value ?? 0) * 100))} per deposit into ${accountName(rules[goal.id]?.accountId ?? null)}` : 'Fund manually · no deposit suggestion' }}</p>
      </article>
    </div>
    <div v-else class="vault-empty"><h3>What would you like to make room for?</h3><p>Start with a goal, then connect it to an account you track.</p><button v-if="demo" class="btn btn-primary" @click="edit()">Create a vault preview</button><RouterLink v-else to="/goals" class="btn btn-primary">Create a savings goal</RouterLink></div>

    <form v-if="demo && editing !== null" class="vault-form" @submit.prevent="save"><div class="section-heading"><h3>{{ editing === 'new' ? 'Shape a new vault' : 'Edit vault preview' }}</h3><button type="button" class="text-button" @click="editing=null">Close</button></div><p class="subtle">Demo only. Changes stay in this browser until you reset the demo.</p><div class="vault-form-grid"><label class="field">Vault name<input v-model="name" required maxlength="120"/></label><label class="field">Linked Budget Tool account<select v-model="accountId"><option :value="null">No account linked</option><option v-for="account in data.accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label class="field">Goal amount ($)<input v-model="target" type="number" min="0.01" step="0.01" required/></label><label class="field">Target date (optional)<input v-model="targetDate" type="date"/></label><label class="field">Suggest from deposits<select v-model="ruleMode"><option value="none">No suggestion · fund manually</option><option value="percent">Percentage of deposit</option><option value="fixed">Fixed dollar amount</option></select></label><template v-if="ruleMode !== 'none'"><label class="field">Receiving account<select v-model="ruleAccountId" required><option :value="null" disabled>Choose an account</option><option v-for="account in data.accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label class="field">{{ ruleMode === 'percent' ? 'Percent of deposit' : 'Amount per deposit ($)' }}<input v-model="ruleValue" type="number" :min="ruleMode === 'percent' ? '1' : '0.01'" :max="ruleMode === 'percent' ? '100' : undefined" :step="ruleMode === 'percent' ? '0.1' : '0.01'" required/></label></template></div><p v-if="formError" class="alert" role="alert">{{ formError }}</p><button class="btn btn-primary">Save preview</button></form>

    <div class="vault-review"><div><p class="page-kicker">Deposit allocation</p><h3>Review before you set it aside.</h3><p>Suggestions divide a deposit within its receiving account. They do not send money between accounts.</p></div><template v-if="demo"><div class="vault-deposit-fields"><label class="field">Deposit received into<select v-model="depositAccountId" @change="suggest"><option v-for="account in data.accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label class="field">Deposit amount ($)<input v-model="depositAmount" type="number" min="0.01" step="0.01" @input="suggest"/></label></div><div v-if="eligible.length" class="vault-suggestions"><label v-for="goal in eligible" :key="goal.id" class="vault-suggestion"><span><strong>{{ goal.name }}</strong><small>{{ rules[goal.id]?.mode === 'percent' ? `${rules[goal.id]?.value}% suggested` : `${money(Math.round((rules[goal.id]?.value ?? 0) * 100))} suggested` }}</small></span><span class="vault-edit-amount">$ <input v-model="draft[goal.id]" type="number" min="0" step="0.01" :aria-label="`Allocation for ${goal.name}`"/></span></label><div class="vault-remainder"><span>Left unallocated</span><strong :class="{ 'vault-overallocated': remaining < 0 }">{{ money(remaining) }}</strong></div><p v-if="reviewError" role="alert" class="alert">{{ reviewError }}</p><p v-if="reviewStatus" role="status" class="finance-notice">{{ reviewStatus }}</p><div class="vault-review-actions"><button class="btn btn-primary" :disabled="remaining < 0" @click="confirmReview">Confirm review</button><button class="text-button" @click="skipReview">Skip suggestions</button></div></div><p v-else class="vault-no-rules">No vault rules match this receiving account. Add a suggestion rule to a demo vault to try the review.</p><small class="vault-preview-note">Preview only. Confirming does not change a balance, fund a vault, or initiate a transfer.</small></template><RouterLink v-else to="/demo/plans" class="text-button">Try deposit review in the demo <FinanceIcon name="arrow"/></RouterLink></div>
  </section>
</template>

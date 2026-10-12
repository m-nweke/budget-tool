<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FinanceData, FinanceGoal } from '../finance/types';
import { demoVaultRules } from '../finance/useFinance';
import type { DemoVaultRule } from '../finance/useFinance';
import FinanceIcon from './FinanceIcon.vue';
import { api } from '../api';

const props = defineProps<{ data: FinanceData; demo: boolean }>();
const emit = defineEmits<{ saveGoal: [goal: FinanceGoal]; saved: [message: string] }>();
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const rules = demoVaultRules;
const editing = ref<number | 'new' | null>(null);
const name = ref('');
const accountId = ref<number | null>(null);
const target = ref('');
const saved = ref('');
const saving = ref(false);
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
const longDate = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** States the rule's trigger and that nothing moves until the owner reviews it. */
function ruleSummary(id: number) {
  const rule = rules[id];
  if (!rule || rule.mode === 'none') return 'You add money yourself. No payday suggestion.';
  const share = rule.mode === 'percent' ? `${rule.value}% of it` : money(Math.round(rule.value * 100));
  return `When you’re paid into ${accountName(rule.accountId)}, we suggest setting aside ${share}. You approve it first.`;
}
/** Turns a target date into the one number a beginner needs: how much to save each month. */
function savePlan(goal: FinanceGoal) {
  const left = goal.target_cents - goal.saved_cents;
  if (left <= 0) return 'Goal reached. Nice work.';
  if (!goal.target_date) return `${money(left)} to go. Add a finish date to see a monthly amount.`;
  const days = (Date.parse(goal.target_date + 'T12:00:00Z') - Date.parse(props.data.as_of + 'T12:00:00Z')) / 86400000;
  if (days <= 0) return `${money(left)} to go. The finish date has passed, so pick a new one or keep saving at your own pace.`;
  const months = Math.max(1, Math.ceil(days / 30.44));
  return `${money(left)} to go. Save about ${money(Math.ceil(left / months / 100) * 100)} a month to finish by ${longDate(goal.target_date)}.`;
}
const examples = [
  { name: 'Emergency fund', target: '1000', why: 'For surprises like a car repair or a vet bill' },
  { name: 'Holiday gifts', target: '600', why: 'Spread a big December over the year' },
  { name: 'Next trip', target: '2000', why: 'Save ahead instead of paying it off later' },
];
const explainerKey = 'vault-explainer-hidden';
const explainerOpen = ref((() => { try { return localStorage.getItem(explainerKey) !== '1'; } catch { return true; } })());
function setExplainer(open: boolean) { explainerOpen.value = open; try { localStorage.setItem(explainerKey, open ? '0' : '1'); } catch { /* storage unavailable */ } }
function startFromExample(example: typeof examples[number]) { edit(); name.value = example.name; target.value = example.target; }
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
  editing.value = goal?.id ?? 'new';
  name.value = goal?.name ?? '';
  accountId.value = goal?.account_id ?? null;
  target.value = goal ? String(goal.target_cents / 100) : '';
  saved.value = goal ? String(goal.saved_cents / 100) : '';
  targetDate.value = goal?.target_date ?? '';
  const rule = goal ? rules[goal.id] : undefined;
  ruleMode.value = rule?.mode ?? 'none';
  ruleValue.value = rule ? String(rule.value) : '';
  ruleAccountId.value = rule?.accountId ?? null;
  formError.value = '';
}
async function save() {
  const targetCents = Math.round(Number(target.value) * 100);
  const savedCents = Math.round(Number(saved.value || 0) * 100);
  const value = Number(ruleValue.value);
  if (!name.value.trim() || !Number.isSafeInteger(targetCents) || targetCents <= 0) {
    formError.value = 'Enter a name and a goal amount greater than zero.'; return;
  }
  if (!Number.isSafeInteger(savedCents) || savedCents < 0) {
    formError.value = 'The amount saved so far can’t be negative.'; return;
  }
  if (props.demo && ruleMode.value !== 'none' && (!ruleAccountId.value || !Number.isFinite(value) || value <= 0 || (ruleMode.value === 'percent' && value > 100))) {
    formError.value = 'Choose the account your paycheck lands in, and an amount (a percentage can’t be over 100).'; return;
  }
  if (!props.demo) {
    // Live vaults are savings goals; the API stores dollars, not cents.
    const dto = { name: name.value.trim(), target_amount: targetCents / 100, saved_amount: savedCents / 100, target_date: targetDate.value || null, bank_account_id: accountId.value };
    saving.value = true;
    try {
      if (editing.value === 'new') await api.createSavingsGoal(dto);
      else if (typeof editing.value === 'number') await api.updateSavingsGoal(editing.value, dto);
      emit('saved', editing.value === 'new' ? `${dto.name} vault created.` : `${dto.name} vault updated.`);
      editing.value = null;
    } catch (e) {
      formError.value = (e as Error).message || 'We couldn’t save this vault. Try again.';
    } finally {
      saving.value = false;
    }
    return;
  }
  if (editing.value === 'new') {
    const id = Math.max(0, ...props.data.goals.map(goal => goal.id)) + 1;
    emit('saveGoal', { id, name: name.value.trim(), account_id: accountId.value, target_cents: targetCents, saved_cents: savedCents, target_date: targetDate.value || null });
    rules[id] = { mode: ruleMode.value, value, accountId: ruleAccountId.value };
  } else if (typeof editing.value === 'number') {
    const goal = props.data.goals.find(item => item.id === editing.value);
    if (goal) emit('saveGoal', { ...goal, name: name.value.trim(), account_id: accountId.value, target_cents: targetCents, saved_cents: savedCents, target_date: targetDate.value || null });
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
  reviewStatus.value = `${money(allocated.value)} set aside across ${eligible.value.length} ${eligible.value.length === 1 ? 'vault' : 'vaults'}. Demo preview: no balances or transfers changed.`;
}
function skipReview() {
  for (const id of Object.keys(draft)) draft[Number(id)] = '0.00';
  reviewError.value = '';
  reviewStatus.value = 'Skipped this paycheck. No balances or transfers changed.';
}
</script>

<template>
  <section class="vaults-section" aria-labelledby="vaults-title">
    <div class="section-heading vaults-heading"><div><p class="page-kicker">Put money aside with intention</p><h2 id="vaults-title">Your vaults</h2></div><button class="btn btn-secondary" @click="edit()"><FinanceIcon name="plus"/> New vault</button></div>
    <section v-if="explainerOpen" class="vault-explainer" aria-labelledby="vault-explainer-title">
      <div class="vault-explainer-head"><h3 id="vault-explainer-title">How vaults work</h3><button type="button" class="text-button" @click="setExplainer(false)">Got it, hide this</button></div>
      <p class="vault-explainer-lede">Think of a vault as a labeled envelope for money you’re saving. The money stays in your account. The vault just remembers what it’s for, so it doesn’t get spent by accident.</p>
      <ol class="vault-steps">
        <li><span aria-hidden="true">1</span><strong>Name a goal</strong><small>For example, “Emergency fund, $1,000”. A finish date is optional.</small></li>
        <li><span aria-hidden="true">2</span><strong>Say where the money is kept</strong><small>Pick the account it sits in, like your savings. Budget Tool never connects to your bank or moves money.</small></li>
        <li><span aria-hidden="true">3</span><strong>Add a little each payday</strong><small>Optional. We suggest an amount from each paycheck; you approve it, change it, or skip it.</small></li>
      </ol>
      <p class="vault-explainer-note"><strong>Why it helps:</strong> savings kept in your everyday account come out of your safe-to-spend number, so you only see money that’s really free.</p>
    </section>
    <button v-else type="button" class="text-button vault-explainer-toggle" @click="setExplainer(true)">How do vaults work?</button>
    <div v-if="data.goals.length" class="vault-grid">
      <article v-for="goal in data.goals" :key="goal.id" class="vault-card">
        <div class="vault-card-top"><span class="vault-mark" aria-hidden="true">◈</span><span class="vault-account">{{ goal.account_id === null ? 'No account chosen yet' : `Kept in ${accountName(goal.account_id)}` }}</span></div>
        <h3>{{ goal.name }}</h3><div class="vault-amount">{{ money(goal.saved_cents) }}</div><p class="vault-target">saved of your {{ money(goal.target_cents) }} goal</p><p class="vault-plan">{{ savePlan(goal) }}</p>
        <progress :value="Math.min(goal.saved_cents, goal.target_cents)" :max="goal.target_cents" :aria-label="`${goal.name} progress`"/>
        <div class="vault-card-bottom"><span>{{ Math.round(goal.saved_cents / goal.target_cents * 100) }}% of goal</span><button class="text-button" :aria-label="`Edit ${goal.name} vault`" @click="edit(goal)">Edit vault <FinanceIcon name="arrow"/></button></div>
        <p v-if="demo" class="vault-rule">{{ ruleSummary(goal.id) }}</p>
      </article>
    </div>
    <div v-else-if="editing === null" class="vault-empty"><h3>What would you like to save for?</h3><p>Not sure where to start? Most people begin with an emergency fund.</p><div class="vault-examples"><button v-for="example in examples" :key="example.name" type="button" class="vault-example" @click="startFromExample(example)"><strong>{{ example.name }} · {{ money(Number(example.target) * 100) }}</strong><small>{{ example.why }}</small></button></div><button class="btn btn-primary" @click="edit()">Start your own vault</button></div>
    <div v-if="data.goals.length && editing === null" class="vault-examples-inline"><span>Ideas:</span><button v-for="example in examples" :key="example.name" type="button" class="text-button" @click="startFromExample(example)">{{ example.name }}</button></div>

    <form v-if="editing !== null" class="vault-form" @submit.prevent="save"><div class="section-heading"><h3>{{ editing === 'new' ? 'Start a new vault' : 'Edit vault' }}</h3><button type="button" class="text-button" @click="editing=null">Close</button></div><p v-if="demo" class="subtle">Demo only. Changes stay in this browser until you reset the demo.</p><p v-else class="subtle">Saved to this workspace. Budget Tool keeps track; it never moves money at your bank.</p><div class="vault-form-grid"><label class="field">What are you saving for?<input v-model="name" required maxlength="120" placeholder="e.g. Emergency fund"/></label><label class="field">Where is this money kept?<select v-model="accountId"><option :value="null">I’ll choose later</option><option v-for="account in data.accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select><small class="field-hint">The account it sits in, like your savings. Nothing moves at your bank.</small></label><label class="field">How much do you want to save? ($)<input v-model="target" type="number" min="0.01" step="0.01" required placeholder="1000"/></label><label class="field">Already saved ($)<input v-model="saved" type="number" min="0" step="0.01" placeholder="0"/><small class="field-hint">Update this whenever you add to it.</small></label><label class="field">Finish by (optional)<input v-model="targetDate" type="date"/><small class="field-hint">We’ll tell you about how much to save each month.</small></label><label v-if="demo" class="field">When I get paid, suggest adding…<select v-model="ruleMode"><option value="none">Nothing. I’ll add money myself</option><option value="percent">A percentage of my paycheck</option><option value="fixed">A set amount from each paycheck</option></select><small class="field-hint">You always see the suggestion and approve it first.</small></label><template v-if="demo && ruleMode !== 'none'"><label class="field">Which account does your paycheck land in?<select v-model="ruleAccountId" required><option :value="null" disabled>Choose an account</option><option v-for="account in data.accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label class="field">{{ ruleMode === 'percent' ? 'Percent of each paycheck' : 'Amount from each paycheck ($)' }}<input v-model="ruleValue" type="number" :min="ruleMode === 'percent' ? '1' : '0.01'" :max="ruleMode === 'percent' ? '100' : undefined" :step="ruleMode === 'percent' ? '0.1' : '0.01'" required/></label></template></div><p v-if="!demo" class="field-hint">Payday suggestions are still a preview. <RouterLink to="/demo/plans">Try them in the demo</RouterLink>.</p><p v-if="formError" class="alert" role="alert">{{ formError }}</p><div class="vault-form-actions"><button class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save vault' }}</button><RouterLink v-if="!demo && typeof editing === 'number'" to="/goals" class="text-button">Delete or more options</RouterLink></div></form>

    <div class="vault-review"><div><p class="page-kicker">Payday check-in</p><h3>Got paid? Set a little aside.</h3><p>Your vaults suggest how much of this paycheck to put toward each goal. Change any amount, or skip this time. It’s bookkeeping inside Budget Tool, so no money moves at your bank.</p></div><template v-if="demo"><div class="vault-deposit-fields"><label class="field">Paycheck landed in<select v-model="depositAccountId" @change="suggest"><option v-for="account in data.accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><label class="field">Paycheck amount ($)<input v-model="depositAmount" type="number" min="0.01" step="0.01" @input="suggest"/></label></div><div v-if="eligible.length" class="vault-suggestions"><label v-for="goal in eligible" :key="goal.id" class="vault-suggestion"><span><strong>{{ goal.name }}</strong><small>{{ rules[goal.id]?.mode === 'percent' ? `Suggested: ${rules[goal.id]?.value}% of this paycheck` : `Suggested: ${money(Math.round((rules[goal.id]?.value ?? 0) * 100))} each paycheck` }}</small></span><span class="vault-edit-amount">$ <input v-model="draft[goal.id]" type="number" min="0" step="0.01" :aria-label="`Amount for ${goal.name}`"/></span></label><div class="vault-remainder"><span>Left for everything else</span><strong :class="{ 'vault-overallocated': remaining < 0 }">{{ money(remaining) }}</strong></div><p v-if="reviewError" role="alert" class="alert">{{ reviewError }}</p><p v-if="reviewStatus" role="status" class="finance-notice">{{ reviewStatus }}</p><div class="vault-review-actions"><button class="btn btn-primary" :disabled="remaining < 0" @click="confirmReview">Looks good</button><button class="text-button" @click="skipReview">Skip this paycheck</button></div></div><p v-else class="vault-no-rules">None of your vaults take a share of paychecks that land in this account yet. Edit a vault and choose “When I get paid, suggest adding…” to try it.</p><small class="vault-preview-note">Demo preview. Nothing here changes a balance or moves money.</small></template><RouterLink v-else to="/demo/plans" class="text-button">Try the payday check-in in the demo <FinanceIcon name="arrow"/></RouterLink></div>
  </section>
</template>

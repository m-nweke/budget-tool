<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../api';
import { formatCurrency, accountLabel } from '../utils/format';
import type {
  Paycheck,
  CreatePaycheckDto,
  CreatePaycheckSplitDto,
  PaycheckFrequency,
  BankAccount,
  BankAccountType,
} from '../types';

const props = defineProps<{
  paycheck: Paycheck | null;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  submit: [data: CreatePaycheckDto];
  cancel: [];
  edit: [];
}>();

// A split row's value is typed loosely (number | string) the same way
// amount/currentBalance are elsewhere in this codebase — lets the input
// start blank ('') instead of a pre-filled 0, so the browser's `required`
// validation actually blocks submitting an unedited split (the server
// rejects value <= 0, so a blank-that-becomes-0 default guaranteed a 400).
// `_key` is a client-only synthetic id (never sent to the server) so Vue
// can track each row's identity across the highest-to-lowest resort below
// — without it, reordering by array index would remount inputs and drop
// focus/mid-edit state.
// `useRemaining` is also client-only: "this row gets whatever's left of
// the paycheck" is a UI convenience, not a third split_type the schema
// knows about (see decision doc) — it's resolved to a plain 'fixed' value
// at submit time.
type SplitRow = Omit<CreatePaycheckSplitDto, 'value'> & {
  value: number | string;
  _key: number;
  useRemaining: boolean;
};

const label = ref('');
const amount = ref<number | string>('');
const frequency = ref<PaycheckFrequency>('biweekly');
const nextPayDate = ref(new Date().toISOString().slice(0, 10));
const splits = ref<SplitRow[]>([]);
const accounts = ref<BankAccount[]>([]);
let nextKey = 0;

watch(
  () => props.paycheck,
  (paycheck) => {
    label.value = paycheck ? paycheck.label : '';
    amount.value = paycheck ? paycheck.amount : '';
    frequency.value = paycheck ? paycheck.frequency : 'biweekly';
    nextPayDate.value = paycheck ? paycheck.next_pay_date : new Date().toISOString().slice(0, 10);
    // Splits have no independent lifecycle of their own (see
    // paycheckRepository) — the form just edits a local copy of the array
    // and submits it wholesale, same as the server replaces it wholesale.
    // Never restored as `useRemaining` — that's a fresh per-edit-session
    // UI choice, not a saved fact about the split.
    splits.value = paycheck
      ? paycheck.splits.map(({ bank_account_id, split_type, value }) => ({
          bank_account_id,
          split_type,
          value,
          _key: nextKey++,
          useRemaining: false,
        }))
      : [];
  },
  { immediate: true }
);

const amountNum = computed(() => Number(amount.value) || 0);
const hasRemainingRow = computed(() => splits.value.some((s) => s.useRemaining));

// Dollar value a row currently represents, regardless of whether the user
// is editing it as a percentage or a fixed amount — the one place that
// conversion happens, reused for sorting, the running total, and the
// "other unit" hint shown next to each row's input.
function effectiveDollar(row: SplitRow): number {
  if (row.useRemaining) return remainingAmount.value;
  const raw = Number(row.value) || 0;
  return row.split_type === 'fixed' ? raw : (raw / 100) * amountNum.value;
}

// What every non-remaining row currently adds up to — the remaining row's
// own value is derived from this, not the other way around, so there's no
// circular dependency even though both are computed.
const allocatedExcludingRemaining = computed(() =>
  splits.value.filter((s) => !s.useRemaining).reduce((sum, s) => sum + effectiveDollar(s), 0)
);
const remainingAmount = computed(() => Math.max(0, amountNum.value - allocatedExcludingRemaining.value));
const totalAllocated = computed(() => allocatedExcludingRemaining.value + (hasRemainingRow.value ? remainingAmount.value : 0));
const overAllocated = computed(() => amountNum.value > 0 && allocatedExcludingRemaining.value > amountNum.value);

// The small "(25.0%)" / "($400.00)" hint next to a row's own input, always
// showing whichever unit the user *isn't* currently typing in.
function otherUnitHint(row: SplitRow): string {
  if (amountNum.value <= 0) return '';
  if (row.split_type === 'fixed') {
    const pct = (effectiveDollar(row) / amountNum.value) * 100;
    return `(${pct.toFixed(1)}%)`;
  }
  return `(${formatCurrency(effectiveDollar(row))})`;
}

// Moves any `useRemaining` row to the end — it's definitionally "whatever's
// left over," not a ranked allocation, so it can never sit anywhere but
// last regardless of how the user has arranged the other rows. Called only
// right after a row is flagged remaining (see toggleRemaining); ordinary
// edits no longer force a re-sort — see moveSplit for user-driven ordering.
function pinRemainingLast() {
  const remaining = splits.value.filter((s) => s.useRemaining);
  const rest = splits.value.filter((s) => !s.useRemaining);
  splits.value = [...rest, ...remaining];
}

// User-driven reordering (swap with the previous/next row) — replaces the
// old auto-sort-by-dollar-amount behavior, which fought with any manual
// arrangement by silently re-sorting back on every blur/change. The
// `useRemaining` row (if any) is always last, so a row can't move past it,
// and the remaining row itself can't move at all.
function moveSplit(index: number, direction: -1 | 1) {
  const row = splits.value[index];
  if (row.useRemaining) return;
  const target = index + direction;
  if (target < 0 || target >= splits.value.length) return;
  if (splits.value[target].useRemaining) return;
  const next = [...splits.value];
  [next[index], next[target]] = [next[target], next[index]];
  splits.value = next;
}

onMounted(async () => {
  accounts.value = await api.getBankAccounts();
  if (!props.paycheck && accounts.value.length && !splits.value.length) {
    addSplit();
  }
});

function addSplit() {
  // Only ever called with accounts.value non-empty (the "+ Add Split"
  // button is disabled otherwise), so accounts.value[0] always exists here.
  splits.value.push({ bank_account_id: accounts.value[0].id, split_type: 'percentage', value: '', _key: nextKey++, useRemaining: false });
}

function removeSplit(index: number) {
  splits.value.splice(index, 1);
}

// Only offered on whichever row is currently last (post-sort) — "the last
// account" absorbing whatever's left is the point; any other row claiming
// it would be ambiguous about what "remaining" even means once a smaller
// row sits after it.
function toggleRemaining(row: SplitRow) {
  if (row.useRemaining) {
    row.useRemaining = false;
    return;
  }
  splits.value.forEach((s) => {
    s.useRemaining = false;
  });
  row.useRemaining = true;
  pinRemainingLast();
}

// Splitting requires an account to split into, but sending someone all the
// way to /accounts and back to add their first one (and then having to
// re-open this form) was the friction behind "why can't I add a split" —
// this quick-create form lets them create one inline instead, without
// leaving the paycheck form.
const showQuickAccount = ref(false);
const quickAccountName = ref('');
const quickAccountType = ref<BankAccountType>('checking');
const quickAccountError = ref('');
const creatingQuickAccount = ref(false);

async function handleQuickAddAccount() {
  quickAccountError.value = '';
  creatingQuickAccount.value = true;
  try {
    const account = await api.createBankAccount({ name: quickAccountName.value, type: quickAccountType.value });
    accounts.value.push(account);
    quickAccountName.value = '';
    quickAccountType.value = 'checking';
    showQuickAccount.value = false;
    addSplit();
  } catch (e) {
    quickAccountError.value = (e as Error).message;
  } finally {
    creatingQuickAccount.value = false;
  }
}

function handleSubmit() {
  emit('submit', {
    label: label.value,
    amount: Number(amount.value),
    frequency: frequency.value,
    next_pay_date: nextPayDate.value,
    // A `useRemaining` row's actual value is whatever remainingAmount was
    // at submit time, always sent as a plain 'fixed' split — the server
    // has no concept of "remaining," only percentage/fixed (see decision).
    splits: splits.value.map((split) =>
      split.useRemaining
        ? { bank_account_id: split.bank_account_id, split_type: 'fixed', value: remainingAmount.value }
        : { bank_account_id: split.bank_account_id, split_type: split.split_type, value: Number(split.value) }
    ),
  });
}
</script>

<template>
  <form class="paycheck-form" @submit.prevent="handleSubmit">
    <fieldset class="fieldset-reset" :disabled="readonly">
    <label class="field">
      Label
      <input v-model="label" type="text" placeholder="e.g. Paycheck" required />
    </label>
    <label class="field">
      Amount
      <input v-model="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <label class="field">
      Frequency
      <select v-model="frequency" required>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="semimonthly">Semimonthly</option>
        <option value="monthly">Monthly</option>
      </select>
    </label>
    <label class="field">
      Next Pay Date
      <input v-model="nextPayDate" type="date" required />
    </label>

    <div class="splits-section">
      <div class="splits-header">
        <span>Splits (optional)</span>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="!accounts.length || hasRemainingRow"
          :title="hasRemainingRow ? 'Turn off the remaining-balance row before adding another split' : ''"
          @click="addSplit"
        >
          + Add Split
        </button>
      </div>
      <template v-if="!accounts.length">
        <p class="field-hint">You'll need a bank account before you can split this paycheck across one.</p>
        <button
          v-if="!showQuickAccount"
          type="button"
          class="btn btn-secondary btn-sm quick-account-toggle"
          @click="showQuickAccount = true"
        >
          + Add an account now
        </button>
        <div v-else class="quick-account-form">
          <p v-if="quickAccountError" class="alert">{{ quickAccountError }}</p>
          <div class="quick-account-row">
            <input v-model="quickAccountName" type="text" placeholder="e.g. Checking" class="form-control" />
            <select v-model="quickAccountType" class="form-control">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="other">Other</option>
            </select>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!quickAccountName || creatingQuickAccount"
              @click="handleQuickAddAccount"
            >
              Create
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="showQuickAccount = false">Cancel</button>
          </div>
        </div>
      </template>
      <template v-else>
        <p class="field-hint">
          Each split is a percentage of the paycheck or a fixed dollar amount. Splits don't need to add up to the full
          amount — use the arrows to arrange the rows, and the last row can be set to soak up whatever's left.
        </p>
        <p v-if="amountNum > 0" class="allocation-summary" :class="{ over: overAllocated }">
          Allocated {{ formatCurrency(totalAllocated) }} of {{ formatCurrency(amountNum) }}
          <span v-if="overAllocated">— over by {{ formatCurrency(totalAllocated - amountNum) }}</span>
        </p>
      </template>
      <div v-for="(split, index) in splits" :key="split._key" class="split-row">
        <div class="reorder-buttons">
          <button
            type="button"
            class="btn-icon"
            title="Move up"
            :disabled="split.useRemaining || index === 0"
            @click="moveSplit(index, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="btn-icon"
            title="Move down"
            :disabled="split.useRemaining || index === splits.length - 1 || splits[index + 1]?.useRemaining"
            @click="moveSplit(index, 1)"
          >
            ↓
          </button>
        </div>
        <select v-model="split.bank_account_id" class="form-control">
          <option v-for="account in accounts" :key="account.id" :value="account.id">{{ accountLabel(account) }}</option>
        </select>
        <select v-model="split.split_type" class="form-control" :disabled="split.useRemaining">
          <option value="percentage">%</option>
          <option value="fixed">$</option>
        </select>
        <div class="split-value">
          <template v-if="split.useRemaining">
            <span class="remaining-value">{{ formatCurrency(remainingAmount) }}</span>
          </template>
          <template v-else>
            <input v-model="split.value" type="number" step="0.01" min="0.01" placeholder="0" required class="form-control" />
            <span v-if="otherUnitHint(split)" class="unit-hint">{{ otherUnitHint(split) }}</span>
          </template>
        </div>
        <button
          v-if="index === splits.length - 1"
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="!split.useRemaining && remainingAmount <= 0"
          @click="toggleRemaining(split)"
        >
          {{ split.useRemaining ? '✓ Remaining' : 'Remaining' }}
        </button>
        <span v-else class="remaining-spacer" />
        <button type="button" class="btn btn-secondary btn-sm" @click="removeSplit(index)">Remove</button>
      </div>
    </div>

    </fieldset>
    <div v-if="!readonly" class="actions">
      <button type="submit" class="btn btn-primary">{{ paycheck ? 'Save Changes' : 'Create Paycheck' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn-primary" @click="$emit('edit')">Edit</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Close</button>
    </div>
  </form>
</template>

<style scoped>
.paycheck-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 560px;
}

.field-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: calc(var(--space-2) * -1);
}

.allocation-summary {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.allocation-summary.over {
  color: var(--color-danger);
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.splits-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.splits-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 0.9rem;
}

.split-row {
  display: grid;
  /* Each row is its own independent grid, not a shared one, so the
     "remaining" slot gets a fixed width rather than `auto` — otherwise its
     track would size differently row to row (button text on the last row,
     an empty spacer on every other row) and the Remove column after it
     would visibly drift out of alignment between rows. */
  grid-template-columns: 40px 1fr 64px 150px 130px auto;
  gap: var(--space-2);
  align-items: center;
}

.reorder-buttons {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.btn-icon {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  cursor: pointer;
  line-height: 1;
  padding: 1px 6px;
  font-size: 0.75rem;
}

.btn-icon:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.split-value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.split-value input {
  min-width: 0;
}

.unit-hint {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.remaining-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary);
  padding: 9px 0;
}

.remaining-spacer {
  display: inline-block;
  width: 1px;
}

.quick-account-toggle {
  align-self: flex-start;
}

.quick-account-form {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}

.quick-account-row {
  display: grid;
  grid-template-columns: 1fr 110px auto auto;
  gap: var(--space-2);
  align-items: center;
}
</style>

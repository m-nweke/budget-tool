<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { api } from '../api';
import { accountLabel } from '../utils/format';
import type { Investment, InvestmentType, CreateInvestmentDto, BankAccount } from '../types';

const props = defineProps<{
  investment: Investment | null;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  submit: [data: CreateInvestmentDto];
  cancel: [];
  edit: [];
}>();

const name = ref('');
const type = ref<InvestmentType>('brokerage');
const currentValue = ref<number | string>('');
const active = ref(true);
const bankAccountId = ref<number | ''>('');
const accounts = ref<BankAccount[]>([]);

// A recurring contribution is opt-in — off by default so a purely
// manually-tracked investment (e.g. a 401k you don't want simulated) never
// has to fill in a contribution day just to leave it blank.
const hasContribution = ref(false);
const monthlyContribution = ref<number | string>('');
const contributionDay = ref<number | string>('');

watch(
  () => props.investment,
  (investment) => {
    name.value = investment ? investment.name : '';
    type.value = investment ? investment.type : 'brokerage';
    currentValue.value = investment ? investment.current_value : '';
    active.value = investment ? investment.active === 1 : true;
    bankAccountId.value = investment?.bank_account_id ?? '';
    hasContribution.value = !!(investment?.monthly_contribution !== null && investment?.monthly_contribution !== undefined);
    monthlyContribution.value = investment?.monthly_contribution ?? '';
    contributionDay.value = investment?.contribution_day ?? '';
  },
  { immediate: true }
);

onMounted(async () => {
  accounts.value = await api.getBankAccounts();
});

function handleSubmit() {
  emit('submit', {
    name: name.value,
    type: type.value,
    current_value: Number(currentValue.value) || 0,
    active: active.value,
    bank_account_id: bankAccountId.value === '' ? null : bankAccountId.value,
    monthly_contribution: hasContribution.value ? Number(monthlyContribution.value) : null,
    contribution_day: hasContribution.value ? Number(contributionDay.value) : null,
  });
}
</script>

<template>
  <form class="investment-form" @submit.prevent="handleSubmit">
    <fieldset class="fieldset-reset" :disabled="readonly">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Vanguard Brokerage" required />
    </label>
    <label class="field">
      Type
      <select v-model="type" required>
        <option value="brokerage">Brokerage</option>
        <option value="retirement">Retirement</option>
        <option value="crypto">Crypto</option>
        <option value="other">Other</option>
      </select>
    </label>
    <label class="field">
      Current Value
      <input v-model="currentValue" type="number" step="0.01" min="0" placeholder="0.00" />
    </label>
    <label v-if="accounts.length" class="field">
      Funded From (optional)
      <select v-model="bankAccountId">
        <option value="">No linked account</option>
        <option v-for="account in accounts" :key="account.id" :value="account.id">{{ accountLabel(account) }}</option>
      </select>
    </label>
    <label class="field field-checkbox">
      <input v-model="hasContribution" type="checkbox" />
      Recurring contribution
    </label>
    <template v-if="hasContribution">
      <label class="field">
        Monthly Contribution
        <input v-model="monthlyContribution" type="number" step="0.01" min="0.01" placeholder="0.00" required />
      </label>
      <label class="field">
        Contribution Day of Month
        <input v-model="contributionDay" type="number" step="1" min="1" max="31" placeholder="1" required />
      </label>
      <p class="field-hint">Folded into the cash-flow simulation as a recurring outflow, same as a bill.</p>
    </template>
    <label class="field field-checkbox">
      <input v-model="active" type="checkbox" />
      Include contribution in cash-flow simulation
    </label>
    </fieldset>
    <div v-if="!readonly" class="actions">
      <button type="submit" class="btn btn-primary">{{ investment ? 'Save Changes' : 'Add Investment' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn-primary" @click="$emit('edit')">Edit</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Close</button>
    </div>
  </form>
</template>

<style scoped>
.investment-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 360px;
}

.field-checkbox {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.field-checkbox input {
  width: auto;
}

.field-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: calc(var(--space-2) * -1);
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

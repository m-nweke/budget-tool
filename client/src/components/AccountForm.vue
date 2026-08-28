<script setup lang="ts">
import { ref, watch } from 'vue';
import type { BankAccount, BankAccountType, CreateBankAccountDto } from '../types';
import { BANK_INSTITUTIONS, OTHER_INSTITUTION } from '../data/bankInstitutions';
import InstitutionPicker from './InstitutionPicker.vue';

const props = defineProps<{
  account: BankAccount | null;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  submit: [data: CreateBankAccountDto];
  cancel: [];
  edit: [];
}>();

const name = ref('');
const type = ref<BankAccountType>('checking');
const currentBalance = ref<number | string>('');
const apy = ref<number | string>('');
// institutionSelect drives the <select>: a curated bank name, '' (none
// picked), or the OTHER_INSTITUTION sentinel — which reveals
// institutionCustom for a free-text name not in the curated list.
const institutionSelect = ref('');
const institutionCustom = ref('');

watch(
  () => props.account,
  (account) => {
    name.value = account ? account.name : '';
    type.value = account ? account.type : 'checking';
    currentBalance.value = account ? account.current_balance : '';
    apy.value = account?.apy ?? '';

    const institution = account?.institution ?? '';
    const isKnown = BANK_INSTITUTIONS.some((b) => b.name === institution);
    if (!institution) {
      institutionSelect.value = '';
      institutionCustom.value = '';
    } else if (isKnown) {
      institutionSelect.value = institution;
      institutionCustom.value = '';
    } else {
      institutionSelect.value = OTHER_INSTITUTION;
      institutionCustom.value = institution;
    }
  },
  { immediate: true }
);

function handleSubmit() {
  const institution =
    institutionSelect.value === OTHER_INSTITUTION
      ? institutionCustom.value.trim() || null
      : institutionSelect.value || null;

  emit('submit', {
    name: name.value,
    type: type.value,
    current_balance: currentBalance.value === '' ? undefined : Number(currentBalance.value),
    // The APY field only renders for type 'savings'/'checking' (see
    // template) — an apy.value of '' while 'other' is selected doesn't mean
    // "the user cleared it," it means the field was never shown. Sending an
    // explicit null there would clear an existing APY the account might
    // still carry (see bankAccountRepository.update's null-vs-undefined
    // handling); undefined tells the server to leave it untouched instead.
    apy: type.value === 'other' ? undefined : apy.value === '' ? null : Number(apy.value),
    institution,
  });
}
</script>

<template>
  <form class="account-form" @submit.prevent="handleSubmit">
    <fieldset class="fieldset-reset" :disabled="readonly">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Checking" required />
    </label>
    <label class="field">
      Type
      <select v-model="type" required>
        <option value="checking">Checking</option>
        <option value="savings">Savings</option>
        <option value="other">Other</option>
      </select>
    </label>
    <label class="field">
      Bank / Institution (optional)
      <InstitutionPicker v-model="institutionSelect" />
    </label>
    <label v-if="institutionSelect === OTHER_INSTITUTION" class="field">
      Institution name
      <input v-model="institutionCustom" type="text" placeholder="e.g. My Local Credit Union" />
    </label>
    <label class="field">
      Current Balance
      <input v-model="currentBalance" type="number" step="0.01" placeholder="0.00" />
    </label>
    <label v-if="type === 'savings' || type === 'checking'" class="field">
      APY % (optional)
      <input v-model="apy" type="number" step="0.01" min="0" max="100" placeholder="e.g. 4.50" />
    </label>
    </fieldset>
    <div v-if="!readonly" class="actions">
      <button type="submit" class="btn btn-primary">{{ account ? 'Save Changes' : 'Create Account' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn-primary" @click="$emit('edit')">Edit</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Close</button>
    </div>
  </form>
</template>

<style scoped>
.account-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 360px;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
</style>

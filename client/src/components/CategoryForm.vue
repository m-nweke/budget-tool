<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../api';
import { useAuth } from '../composables/useAuth';
import type { Category, CreateCategoryDto, Department } from '../types';

const props = defineProps<{
  category: Category | null;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  submit: [data: CreateCategoryDto];
  cancel: [];
  edit: [];
}>();

const { user } = useAuth();
// A personal tenant has no departments at all — categories always have
// department_id: null server-side (mirrors the owner-role branch in
// routes/categories.ts), so the field is never shown, not just optional.
// A computed (not a plain const read once) because `user` is a shared
// singleton that a tenant switch elsewhere in the app mutates in place.
const isPersonal = computed(() => user.value?.tenant_type === 'personal');

const name = ref('');
const budgetedAmount = ref<number | string>('');
const startOn = ref(new Date().toISOString().slice(0, 10));
const departmentId = ref<number | ''>('');
const approvalThreshold = ref<number | string>('');
const departments = ref<Department[]>([]);
const showNewDepartmentField = ref(false);
const newDepartmentName = ref('');
const departmentError = ref('');
const creatingDepartment = ref(false);

watch(
  () => props.category,
  (category) => {
    name.value = category ? category.name : '';
    budgetedAmount.value = category ? category.budgeted_amount : '';
    startOn.value = category ? category.start_on : new Date().toISOString().slice(0, 10);
    departmentId.value = category?.department_id ?? '';
    approvalThreshold.value = category?.approval_threshold ?? '';
  },
  { immediate: true }
);

onMounted(async () => {
  if (isPersonal.value) return;
  departments.value = await api.getDepartments();
  // A head with exactly one accessible department shouldn't have to pick
  // it — same "auto-select the only option" pattern as the transactions
  // category filter.
  if (!props.category && departments.value.length === 1) {
    departmentId.value = departments.value[0].id;
  }
  // A brand-new company has zero departments — nothing to pick from, so
  // open the create-department affordance immediately instead of leaving
  // the head staring at an empty, unusable select.
  if (!departments.value.length) {
    showNewDepartmentField.value = true;
  }
});

async function handleCreateDepartment() {
  const trimmedName = newDepartmentName.value.trim();
  if (creatingDepartment.value || !trimmedName) return;
  departmentError.value = '';
  creatingDepartment.value = true;
  try {
    const department = await api.createDepartment(trimmedName);
    departments.value.push(department);
    departmentId.value = department.id;
    newDepartmentName.value = '';
    showNewDepartmentField.value = false;
  } catch (e) {
    departmentError.value = (e as Error).message;
  } finally {
    creatingDepartment.value = false;
  }
}

function handleSubmit() {
  emit('submit', {
    name: name.value,
    budgeted_amount: Number(budgetedAmount.value),
    start_on: startOn.value,
    department_id: departmentId.value === '' ? null : departmentId.value,
    approval_threshold: approvalThreshold.value === '' ? null : Number(approvalThreshold.value),
  });
}
</script>

<template>
  <form class="category-form" @submit.prevent="handleSubmit">
    <fieldset class="fieldset-reset" :disabled="readonly">
    <label class="field">
      Name
      <input v-model="name" type="text" placeholder="e.g. Office Supplies" required />
    </label>
    <label class="field">
      Budgeted Amount
      <input v-model="budgetedAmount" type="number" step="0.01" min="0" placeholder="0.00" required />
    </label>
    <template v-if="!isPersonal">
      <label v-if="departments.length" class="field">
        Department
        <select v-model="departmentId" required>
          <option value="" disabled>Select a department</option>
          <option v-for="department in departments" :key="department.id" :value="department.id">
            {{ department.name }}
          </option>
        </select>
      </label>

      <p v-if="departmentError" class="alert">{{ departmentError }}</p>

      <button
        v-if="!showNewDepartmentField"
        type="button"
        class="btn btn-secondary new-department-toggle"
        @click="showNewDepartmentField = true"
      >
        + New department
      </button>
      <div v-else class="field new-department-field">
        <label>
          {{ departments.length ? 'New department name' : 'Department name' }}
          <input
            v-model="newDepartmentName"
            type="text"
            placeholder="e.g. Engineering"
            @keydown.enter.prevent="handleCreateDepartment"
          />
        </label>
        <div class="actions">
          <button
            type="button"
            class="btn btn-secondary"
            @click="handleCreateDepartment"
            :disabled="!newDepartmentName.trim() || creatingDepartment"
          >
            Add department
          </button>
          <button v-if="departments.length" type="button" class="btn btn-secondary" @click="showNewDepartmentField = false">
            Cancel
          </button>
        </div>
      </div>
    </template>
    <label class="field">
      Approval Threshold (optional)
      <input v-model="approvalThreshold" type="number" step="0.01" min="0" placeholder="No threshold" />
    </label>
    <p class="field-hint">
      A transaction over this amount needs your approval before it counts toward the budget. Leave blank to auto-approve everything in this category.
    </p>
    <label class="field">
      Starts On
      <input v-model="startOn" type="date" required />
    </label>
    <p class="field-hint">
      The month this budget takes effect from — the dashboard only shows this category for months on or after this date. Backdate it if you're logging older transactions against it.
    </p>
    </fieldset>
    <div v-if="!readonly" class="actions">
      <button type="submit" class="btn btn-primary">{{ category ? 'Save Changes' : 'Create Category' }}</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn-primary" @click="$emit('edit')">Edit</button>
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">Close</button>
    </div>
  </form>
</template>

<style scoped>
.category-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 360px;
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

.new-department-toggle {
  align-self: flex-start;
  margin-top: calc(var(--space-3) * -1);
}

.new-department-field {
  margin-top: calc(var(--space-3) * -1);
}
</style>

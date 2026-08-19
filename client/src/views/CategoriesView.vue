<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import { useAuth } from '../composables/useAuth';
import CategoryForm from '../components/CategoryForm.vue';
import KebabMenu from '../components/KebabMenu.vue';
import { formatCurrency } from '../utils/format';
import type { Category, CreateCategoryDto, Department } from '../types';

const { canManageBudget } = useAuth();
const categories = ref<Category[]>([]);
const departments = ref<Department[]>([]);
const showForm = ref(false);
const editingCategory = ref<Category | null>(null);
const error = ref('');
const loaded = ref(false);
const viewTop = ref<HTMLElement | null>(null);

// Only worth labeling categories by department when there's more than one
// in view — a head scoped to a single department gets no extra info from
// seeing that department's name repeated on every row.
const showDepartmentLabel = computed(() => departments.value.length > 1);
const departmentNameById = computed(() => {
  const map: Record<number, string> = {};
  for (const department of departments.value) {
    map[department.id] = department.name;
  }
  return map;
});

function scrollToForm() {
  viewTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadCategories() {
  [categories.value, departments.value] = await Promise.all([api.getCategories(), api.getDepartments()]);
  loaded.value = true;
}

function openCreateForm() {
  editingCategory.value = null;
  showForm.value = true;
  scrollToForm();
}

function openEditForm(category: Category) {
  editingCategory.value = category;
  showForm.value = true;
  scrollToForm();
}

function closeForm() {
  showForm.value = false;
  editingCategory.value = null;
}

async function handleSubmit(data: CreateCategoryDto) {
  error.value = '';
  try {
    if (editingCategory.value) {
      await api.updateCategory(editingCategory.value.id, data);
    } else {
      await api.createCategory(data);
    }
    closeForm();
    await loadCategories();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleDelete(category: Category) {
  error.value = '';
  try {
    await api.deleteCategory(category.id);
    await loadCategories();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(loadCategories);
</script>

<template>
  <div ref="viewTop" class="view-header">
    <div>
      <h1>Categories</h1>
      <p>Set a budget for each spending category.</p>
    </div>
    <button v-if="canManageBudget && !showForm && categories.length" class="btn btn-primary" @click="openCreateForm">
      + Add Category
    </button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="canManageBudget && showForm" class="panel form-panel">
    <h2>{{ editingCategory ? 'Edit Category' : 'New Category' }}</h2>
    <CategoryForm :category="editingCategory" @submit="handleSubmit" @cancel="closeForm" />
  </div>

  <div v-if="loaded && !categories.length && !showForm" class="empty-state">
    <h3>No categories yet</h3>
    <p v-if="canManageBudget">Categories are how you set budgets — create one to start tracking spending against it.</p>
    <p v-else>No categories have been set up for your department yet — check with your department head.</p>
    <button v-if="canManageBudget" class="btn btn-primary" @click="openCreateForm">Create your first category</button>
  </div>

  <ul v-else class="category-list">
    <li v-for="category in categories" :key="category.id" class="card category-row">
      <div>
        <div class="category-name">
          {{ category.name }}
          <span v-if="showDepartmentLabel" class="badge badge-department">
            {{ departmentNameById[category.department_id ?? -1] }}
          </span>
        </div>
        <div class="category-amount">{{ formatCurrency(category.budgeted_amount) }} budgeted</div>
      </div>
      <KebabMenu v-if="canManageBudget">
        <button type="button" @click="openEditForm(category)">Edit</button>
        <button type="button" class="danger" @click="handleDelete(category)">Delete</button>
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

.category-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
}

.category-name {
  font-weight: 600;
}

.category-amount {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>

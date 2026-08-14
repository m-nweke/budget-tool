<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';
import CategoryForm from '../components/CategoryForm.vue';
import { formatCurrency } from '../format';
import type { Category, NewCategory } from '../types';

const categories = ref<Category[]>([]);
const showForm = ref(false);
const editingCategory = ref<Category | null>(null);
const error = ref('');
const loaded = ref(false);

async function loadCategories() {
  categories.value = await api.getCategories();
  loaded.value = true;
}

function openCreateForm() {
  editingCategory.value = null;
  showForm.value = true;
}

function openEditForm(category: Category) {
  editingCategory.value = category;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingCategory.value = null;
}

async function handleSubmit(data: NewCategory) {
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
  <div class="view-header">
    <div>
      <h1>Categories</h1>
      <p>Set a budget for each spending category.</p>
    </div>
    <button v-if="!showForm && categories.length" class="btn btn-primary" @click="openCreateForm">
      + Add Category
    </button>
  </div>

  <p v-if="error" class="alert">{{ error }}</p>

  <div v-if="showForm" class="panel form-panel">
    <h2>{{ editingCategory ? 'Edit Category' : 'New Category' }}</h2>
    <CategoryForm :category="editingCategory" @submit="handleSubmit" @cancel="closeForm" />
  </div>

  <div v-if="loaded && !categories.length && !showForm" class="empty-state">
    <h3>No categories yet</h3>
    <p>Categories are how you set budgets — create one to start tracking spending against it.</p>
    <button class="btn btn-primary" @click="openCreateForm">Create your first category</button>
  </div>

  <ul v-else class="category-list">
    <li v-for="category in categories" :key="category.id" class="card category-row">
      <div>
        <div class="category-name">{{ category.name }}</div>
        <div class="category-amount">{{ formatCurrency(category.budgeted_amount) }} budgeted</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-secondary btn-sm" @click="openEditForm(category)">Edit</button>
        <button class="btn btn-danger btn-sm" @click="handleDelete(category)">Delete</button>
      </div>
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

.row-actions {
  display: flex;
  gap: var(--space-2);
}
</style>

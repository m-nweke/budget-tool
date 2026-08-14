<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import CategoryForm from '../components/CategoryForm.vue';

const categories = ref([]);
const showForm = ref(false);
const editingCategory = ref(null);
const error = ref('');

async function loadCategories() {
  categories.value = await api.getCategories();
}

function openCreateForm() {
  editingCategory.value = null;
  showForm.value = true;
}

function openEditForm(category) {
  editingCategory.value = category;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingCategory.value = null;
}

async function handleSubmit(data) {
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
    error.value = e.message;
  }
}

async function handleDelete(category) {
  error.value = '';
  try {
    await api.deleteCategory(category.id);
    await loadCategories();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(loadCategories);
</script>

<template>
  <h1>Categories</h1>
  <p v-if="error" class="error">{{ error }}</p>

  <button v-if="!showForm" @click="openCreateForm">Add Category</button>

  <CategoryForm
    v-if="showForm"
    :category="editingCategory"
    @submit="handleSubmit"
    @cancel="closeForm"
  />

  <ul class="category-list">
    <li v-for="category in categories" :key="category.id">
      <span>{{ category.name }} — ${{ category.budgeted_amount.toFixed(2) }}</span>
      <span class="row-actions">
        <button @click="openEditForm(category)">Edit</button>
        <button @click="handleDelete(category)">Delete</button>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.error {
  color: #b91c1c;
}

.category-list {
  list-style: none;
  padding: 0;
  margin-top: 1rem;
}

.category-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.row-actions {
  display: flex;
  gap: 0.5rem;
}
</style>

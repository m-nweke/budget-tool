<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { api } from '../api';
import type { Category } from '../types';
import { formatCurrency } from '../utils/currency';
import KebabMenu from '../components/KebabMenu.vue';
import CategoryForm from '../components/CategoryForm.vue';

const categories = ref<Category[]>([]);
const loaded = ref(false);
const showForm = ref(false);
const editing = ref<Category | null>(null);
const formAnchor = ref<HTMLElement | null>(null);
const error = ref('');

async function load() {
  categories.value = await api.getCategories();
  loaded.value = true;
}

async function openCreate() {
  editing.value = null;
  showForm.value = true;
  await nextTick();
  formAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openEdit(category: Category) {
  editing.value = category;
  showForm.value = true;
  await nextTick();
  formAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onSubmit(payload: { name: string; budgeted_amount: number; start_on?: string }) {
  error.value = '';
  try {
    if (editing.value) {
      await api.updateCategory(editing.value.id, payload);
    } else {
      await api.createCategory(payload);
    }
    showForm.value = false;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function onDelete(category: Category) {
  error.value = '';
  try {
    await api.deleteCategory(category.id);
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(load);
</script>

<template>
  <div class="page-header">
    <h1>Categories</h1>
    <button class="primary" @click="openCreate">New Category</button>
  </div>

  <p v-if="error" class="tier-red">{{ error }}</p>

  <div ref="formAnchor">
    <CategoryForm v-if="showForm" :category="editing" @submit="onSubmit" @cancel="showForm = false" />
  </div>

  <div v-if="loaded && categories.length === 0" class="empty-state">
    No categories yet. Create the first one to start tracking budget.
  </div>

  <table v-else-if="loaded">
    <thead>
      <tr>
        <th>Name</th>
        <th>Budgeted (monthly)</th>
        <th>Start On</th>
        <th class="actions-col"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="c in categories" :key="c.id">
        <td>{{ c.name }}</td>
        <td>{{ formatCurrency(c.budgeted_amount) }}</td>
        <td>{{ c.start_on }}</td>
        <td class="actions-col">
          <KebabMenu>
            <button @click="openEdit(c)">Edit</button>
            <button class="danger" @click="onDelete(c)">Delete</button>
          </KebabMenu>
        </td>
      </tr>
    </tbody>
  </table>
</template>

import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import Transactions from '../views/Transactions.vue';
import Categories from '../views/Categories.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/transactions', component: Transactions },
    { path: '/categories', component: Categories },
  ],
});

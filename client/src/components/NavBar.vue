<script setup></script>

<template>
  <nav class="nav-bar">
    <RouterLink to="/">Dashboard</RouterLink>
    <RouterLink to="/transactions">Transactions</RouterLink>
    <RouterLink to="/categories">Categories</RouterLink>
  </nav>
</template>

<style scoped>
.nav-bar {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ddd;
}

.nav-bar a {
  text-decoration: none;
  color: #333;
  font-weight: 500;
}

.nav-bar a.router-link-exact-active {
  color: #2563eb;
}
</style>

<script setup lang="ts"></script>

<template>
  <nav class="navbar">
    <div class="navbar-inner">
      <span class="brand">Budget Tool</span>
      <RouterLink to="/" exact-active-class="active">Dashboard</RouterLink>
      <RouterLink to="/transactions" active-class="active">Transactions</RouterLink>
      <RouterLink to="/categories" active-class="active">Categories</RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  background: #1f2937;
  color: white;
}
.navbar-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.brand {
  font-weight: 700;
  margin-right: 1rem;
}
a {
  color: #cbd5e1;
  text-decoration: none;
  padding: 0.25rem 0;
  border-bottom: 2px solid transparent;
}
a.active {
  color: white;
  border-bottom-color: #60a5fa;
}
a:hover {
  color: white;
}
</style>

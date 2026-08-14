<script setup>
import NavBar from './components/NavBar.vue';
</script>

<template>
  <NavBar />
  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
}
</style>

<script setup lang="ts">
import AdminSessionLocations from '../components/admin/AdminSessionLocations.vue'
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/admin" class="text-zinc-600 hover:text-zinc-400 transition-colors text-sm">⚙️ Admin</RouterLink>
      <span class="text-zinc-700">/</span>
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📍 Session Locations</h1>
    </div>
    <AdminSessionLocations />
  </div>
</template>

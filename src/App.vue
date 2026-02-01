<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import AppLayout from './components/layout/AppLayout.vue'

const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.loading" class="min-h-screen flex items-center justify-center bg-stone-900">
    <div class="text-amber-500 text-xl animate-pulse">Loading...</div>
  </div>
  <AppLayout v-else>
    <RouterView />
  </AppLayout>
</template>

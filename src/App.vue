<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import AppLayout from './components/layout/AppLayout.vue'

const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.loading" class="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
    <div class="text-center">
      <div class="text-3xl mb-3 animate-pulse">⚔️</div>
      <div class="text-amber-500/60 text-sm">Loading...</div>
    </div>
  </div>
  <AppLayout v-else>
    <RouterView />
  </AppLayout>
</template>

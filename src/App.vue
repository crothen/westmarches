<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import AppLayout from './components/layout/AppLayout.vue'
const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.loading" class="min-h-screen bg-black flex items-center justify-center">
    <div class="text-center">
      <div class="w-5 h-5 bg-[#ef233c] rounded-sm rotate-45 mx-auto mb-4 animate-pulse"></div>
      <div class="text-zinc-600 text-xs uppercase tracking-widest font-semibold" style="font-family: Manrope, sans-serif">Loading</div>
    </div>
  </div>
  <AppLayout v-else>
    <RouterView />
  </AppLayout>
</template>

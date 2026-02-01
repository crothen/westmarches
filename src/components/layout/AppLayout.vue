<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

const auth = useAuthStore()
const sidebarOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-[var(--bg-primary)]">
    <!-- Subtle gradient overlay -->
    <div class="fixed inset-0 bg-gradient-to-br from-amber-500/[0.02] via-transparent to-blue-500/[0.02] pointer-events-none" />
    
    <div class="relative">
      <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <div class="flex">
        <AppSidebar v-if="auth.isAuthenticated" :open="sidebarOpen" @close="sidebarOpen = false" />
        <main class="flex-1 p-6 lg:p-8 max-w-7xl">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

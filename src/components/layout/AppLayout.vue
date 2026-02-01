<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

const auth = useAuthStore()
const sidebarOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-stone-900 text-stone-100">
    <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <div class="flex">
      <AppSidebar v-if="auth.isAuthenticated" :open="sidebarOpen" @close="sidebarOpen = false" />
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

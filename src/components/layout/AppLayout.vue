<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

const auth = useAuthStore()
const sidebarOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-black text-zinc-300 relative">
    <!-- Background effects (no starfield) -->
    <div class="fixed inset-0 z-0 pointer-events-none">
      <div class="absolute inset-0 bg-gradient-to-b from-[#1a0505] via-black to-black"></div>
      <!-- Subtle red glow -->
      <div class="absolute top-0 left-1/3 w-[600px] h-[600px] bg-red-600/[0.03] rounded-full blur-[150px]"></div>
      <!-- Grid overlay -->
      <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black_30%,transparent_80%)]"></div>
    </div>

    <div class="relative z-10">
      <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <div class="flex pt-[72px]">
        <AppSidebar v-if="auth.isAuthenticated" :open="sidebarOpen" @close="sidebarOpen = false" />
        <main class="flex-1 p-6 lg:p-8 min-w-0">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

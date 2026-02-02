<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

const emit = defineEmits<{ 'toggle-sidebar': [] }>()
const auth = useAuthStore()
</script>

<template>
  <header class="fixed top-0 left-0 w-full z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.06] shadow-2xl">
    <nav class="flex items-center justify-between px-4 sm:px-6 py-2.5">
      <div class="flex items-center gap-3">
        <button v-if="auth.isAuthenticated" @click="emit('toggle-sidebar')" class="text-zinc-500 hover:text-white lg:hidden transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <RouterLink to="/" class="flex items-center gap-2.5 group">
          <div class="w-4 h-4 bg-[#ef233c] rounded-sm rotate-45 group-hover:rotate-[225deg] transition-transform duration-300"></div>
          <span class="text-lg font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">West Marches</span>
        </RouterLink>
      </div>
      <div v-if="!auth.isAuthenticated" class="flex items-center">
        <RouterLink to="/login" class="btn !py-2 !px-5 !rounded-full !text-xs">Get Access</RouterLink>
      </div>
    </nav>
  </header>
</template>

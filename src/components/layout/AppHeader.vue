<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'

const emit = defineEmits<{ 'toggle-sidebar': [] }>()
const auth = useAuthStore()
const router = useRouter()

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg-secondary)]/80 border-b border-white/[0.06] px-4 lg:px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button v-if="auth.isAuthenticated" @click="emit('toggle-sidebar')" class="text-slate-400 hover:text-amber-500 lg:hidden transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <RouterLink to="/" class="flex items-center gap-2 group">
        <span class="text-lg">⚔️</span>
        <span class="text-lg font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent group-hover:from-amber-300 group-hover:to-amber-500 transition-all">West Marches</span>
      </RouterLink>
    </div>
    <div class="flex items-center gap-3">
      <template v-if="auth.isAuthenticated">
        <span class="text-slate-400 text-sm hidden sm:block">{{ auth.appUser?.displayName }}</span>
        <span class="text-[0.65rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold uppercase tracking-wider">{{ auth.role }}</span>
        <button @click="handleLogout" class="text-slate-500 hover:text-red-400 text-sm transition-colors">Logout</button>
      </template>
      <template v-else>
        <RouterLink to="/login" class="btn-primary text-sm !py-1.5 !px-4">Login</RouterLink>
      </template>
    </div>
  </header>
</template>

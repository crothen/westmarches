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
  <header class="bg-stone-800 border-b border-stone-700 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button v-if="auth.isAuthenticated" @click="emit('toggle-sidebar')" class="text-stone-400 hover:text-amber-500 lg:hidden">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <RouterLink to="/" class="text-xl font-bold text-amber-500 hover:text-amber-400 tracking-wide">
        ⚔️ West Marches
      </RouterLink>
    </div>
    <div class="flex items-center gap-4">
      <template v-if="auth.isAuthenticated">
        <span class="text-stone-400 text-sm hidden sm:block">{{ auth.appUser?.displayName }}</span>
        <span class="text-xs px-2 py-0.5 rounded bg-stone-700 text-amber-500 uppercase">{{ auth.role }}</span>
        <button @click="handleLogout" class="text-stone-400 hover:text-red-400 text-sm">Logout</button>
      </template>
      <template v-else>
        <RouterLink to="/login" class="text-amber-500 hover:text-amber-400 text-sm">Login</RouterLink>
      </template>
    </div>
  </header>
</template>

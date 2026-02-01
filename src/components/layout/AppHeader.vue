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
  <header class="fixed top-0 left-0 w-full z-50 px-4 pt-4">
    <nav class="max-w-[1800px] mx-auto flex items-center justify-between bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-6 py-2.5 shadow-2xl">
      <div class="flex items-center gap-3">
        <button v-if="auth.isAuthenticated" @click="emit('toggle-sidebar')" class="text-zinc-500 hover:text-white lg:hidden transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <RouterLink to="/" class="flex items-center gap-2.5 group">
          <div class="w-4 h-4 bg-[#ef233c] rounded-sm rotate-45 group-hover:rotate-[225deg] transition-transform duration-300"></div>
          <span class="text-lg font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">West Marches</span>
        </RouterLink>
      </div>
      <div class="flex items-center gap-4">
        <template v-if="auth.isAuthenticated">
          <span class="text-zinc-500 text-sm hidden sm:block">{{ auth.appUser?.displayName }}</span>
          <span v-for="r in auth.roles" :key="r" class="text-[0.6rem] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest" :class="r === 'admin' ? 'bg-[#ef233c]/10 text-[#ef233c]' : r === 'dm' ? 'bg-purple-500/10 text-purple-400' : 'bg-white/5 text-zinc-400'" style="font-family: Manrope, sans-serif">{{ r }}</span>
          <button @click="handleLogout" class="text-zinc-600 hover:text-white text-sm transition-colors">Logout</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn !py-2 !px-5 !rounded-full !text-xs">Get Access</RouterLink>
        </template>
      </div>
    </nav>
  </header>
</template>

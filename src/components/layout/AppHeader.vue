<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { usePwa } from '../../composables/usePwa'

const emit = defineEmits<{ 'toggle-sidebar': [] }>()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { isPwa } = usePwa()

// Show back button in PWA mode when not on home
const showBackButton = computed(() => {
  return isPwa.value && route.path !== '/'
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<template>
  <header class="fixed top-0 left-0 w-full z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.06] shadow-2xl" :style="isPwa ? 'padding-top: env(safe-area-inset-top, 0px)' : ''">
    <nav class="flex items-center justify-between px-4 sm:px-6 py-2.5">
      <div class="flex items-center gap-3">
        <!-- PWA: Back button -->
        <button 
          v-if="showBackButton" 
          @click="goBack" 
          class="text-zinc-400 hover:text-white transition-colors -ml-1 p-1"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <!-- Sidebar toggle (non-PWA only) -->
        <button 
          v-else-if="auth.isAuthenticated && !isPwa" 
          @click="emit('toggle-sidebar')" 
          class="text-zinc-500 hover:text-white lg:hidden transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <RouterLink to="/" class="flex items-center group">
          <span class="text-lg font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">West Marches</span>
        </RouterLink>
      </div>
      
      <div v-if="!auth.isAuthenticated" class="flex items-center">
        <RouterLink to="/login" class="btn !py-2 !px-5 !rounded-full !text-xs">Get Access</RouterLink>
      </div>
    </nav>
  </header>
</template>

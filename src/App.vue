<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { usePwa } from './composables/usePwa'
import AppLayout from './components/layout/AppLayout.vue'
import MentionTooltip from './components/common/MentionTooltip.vue'
import PwaBottomNav from './components/layout/PwaBottomNav.vue'
import PwaSplash from './components/layout/PwaSplash.vue'
import PwaPullRefresh from './components/layout/PwaPullRefresh.vue'
import PwaHeader from './components/layout/PwaHeader.vue'
import PwaUpdatePrompt from './components/layout/PwaUpdatePrompt.vue'
import { showTooltip, hideTooltip } from './composables/useEntityTooltip'
import type { MentionKind } from './lib/mentionRenderer'

const route = useRoute()
const auth = useAuthStore()
const { isPwa } = usePwa()

// Check if current route wants no layout (fullscreen views)
const noLayout = computed(() => route.meta.noLayout === true)

// No special PWA map handling - use normal layout

// Global hover handler for v-html rendered mentions (outside MentionText)
function onGlobalMouseOver(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('mention-link') || target.classList.contains('mention-pin')) {
    const kind = target.dataset.mentionKind as MentionKind
    const id = target.dataset.mentionId
    if (kind && id) {
      const rect = target.getBoundingClientRect()
      showTooltip(kind, id, rect.left, rect.bottom + 6)
    }
  }
}

function onGlobalMouseOut(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('mention-link') || target.classList.contains('mention-pin')) {
    hideTooltip()
  }
}

onMounted(() => {
  document.addEventListener('mouseover', onGlobalMouseOver)
  document.addEventListener('mouseout', onGlobalMouseOut)
  
  // Add PWA class to body for global styling
  if (isPwa.value) {
    document.body.classList.add('pwa-mode')
  }
})
onUnmounted(() => {
  document.removeEventListener('mouseover', onGlobalMouseOver)
  document.removeEventListener('mouseout', onGlobalMouseOut)
})
</script>

<template>
  <!-- PWA Splash Screen -->
  <PwaSplash v-if="isPwa" />
  
  <!-- PWA Pull to Refresh -->
  <PwaPullRefresh v-if="isPwa && !noLayout" />
  
  <div v-if="auth.loading" class="min-h-screen bg-black flex items-center justify-center">
    <div class="text-center">
      <div class="w-5 h-5 bg-[#ef233c] rounded-sm rotate-45 mx-auto mb-4 animate-pulse"></div>
      <div class="text-zinc-600 text-xs uppercase tracking-widest font-semibold" style="font-family: Manrope, sans-serif">Loading</div>
    </div>
  </div>
  
  <!-- No layout for fullscreen views -->
  <template v-else-if="noLayout">
    <RouterView v-slot="{ Component }">
      <transition :name="isPwa ? 'pwa-page' : ''" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
  </template>
  
  <!-- PWA Layout -->
  <template v-else-if="isPwa && auth.isAuthenticated">
    <PwaHeader />
    <main class="pwa-main">
      <RouterView v-slot="{ Component }">
        <transition name="pwa-page" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
    <PwaBottomNav />
  </template>
  
  <!-- Regular Layout -->
  <AppLayout v-else>
    <RouterView v-slot="{ Component }">
      <transition :name="isPwa ? 'pwa-page' : ''" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
  </AppLayout>
  
  <MentionTooltip />
  
  <!-- PWA Update Prompt -->
  <PwaUpdatePrompt v-if="isPwa" />
</template>

<style>
/* PWA mode global styles */
body.pwa-mode {
  /* Prevent overscroll bounce */
  overscroll-behavior: none;
  /* Safe area padding */
  padding-top: env(safe-area-inset-top, 0px);
}

/* PWA main content area */
.pwa-main {
  padding-top: calc(56px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  min-height: 100vh;
  padding-left: 16px;
  padding-right: 16px;
}

/* Hide install prompts in PWA mode */
body.pwa-mode .install-prompt,
body.pwa-mode [data-install-prompt] {
  display: none !important;
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from './stores/auth'
import AppLayout from './components/layout/AppLayout.vue'
import MentionTooltip from './components/common/MentionTooltip.vue'
import { showTooltip, hideTooltip } from './composables/useEntityTooltip'
import type { MentionKind } from './lib/mentionRenderer'

const auth = useAuthStore()

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
})
onUnmounted(() => {
  document.removeEventListener('mouseover', onGlobalMouseOver)
  document.removeEventListener('mouseout', onGlobalMouseOut)
})
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
  <MentionTooltip />
</template>

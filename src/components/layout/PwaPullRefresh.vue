<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const pulling = ref(false)
const pullDistance = ref(0)
const refreshing = ref(false)

const THRESHOLD = 80
const MAX_PULL = 120

let startY = 0
let currentY = 0

function onTouchStart(e: TouchEvent) {
  if (window.scrollY > 0 || refreshing.value) return
  const touch = e.touches[0]
  if (!touch) return
  startY = touch.clientY
  pulling.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!pulling.value || refreshing.value) return
  
  const touch = e.touches[0]
  if (!touch) return
  currentY = touch.clientY
  const diff = currentY - startY
  
  if (diff > 0 && window.scrollY === 0) {
    pullDistance.value = Math.min(diff * 0.5, MAX_PULL)
    if (pullDistance.value > 10) {
      e.preventDefault()
    }
  }
}

function onTouchEnd() {
  if (!pulling.value) return
  
  if (pullDistance.value >= THRESHOLD && !refreshing.value) {
    refreshing.value = true
    pullDistance.value = 60
    
    // Refresh by reloading current route
    setTimeout(() => {
      router.go(0)
    }, 300)
  } else {
    pullDistance.value = 0
  }
  
  pulling.value = false
}

onMounted(() => {
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
})

onUnmounted(() => {
  document.removeEventListener('touchstart', onTouchStart)
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onTouchEnd)
})
</script>

<template>
  <div
    class="pull-refresh-indicator"
    :style="{ 
      transform: `translateY(${pullDistance - 60}px)`,
      opacity: pullDistance / THRESHOLD
    }"
  >
    <div :class="['pull-icon', { spinning: refreshing }]">
      {{ refreshing ? '↻' : '↓' }}
    </div>
    <span class="pull-text">
      {{ refreshing ? 'Refreshing...' : pullDistance >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh' }}
    </span>
  </div>
</template>

<style scoped>
.pull-refresh-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #888;
  font-size: 13px;
  z-index: 999;
  pointer-events: none;
}

.pull-icon {
  font-size: 18px;
  transition: transform 0.2s;
}

.pull-icon.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

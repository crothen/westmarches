<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

defineProps<{
  imageUrl: string
  hexLabel: string
}>()

const emit = defineEmits<{ close: [] }>()

const scale = ref(1)
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const lastPos = ref({ x: 0, y: 0 })

// Touch state
const lastTouchDist = ref(0)
const lastTouchCenter = ref({ x: 0, y: 0 })
const isTouching = ref(false)

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  scale.value = Math.min(Math.max(scale.value * zoomFactor, 0.1), 10)
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging.value = true
  lastPos.value = { x: e.clientX, y: e.clientY }
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  position.value.x += e.clientX - lastPos.value.x
  position.value.y += e.clientY - lastPos.value.y
  lastPos.value = { x: e.clientX, y: e.clientY }
}

function onMouseUp() {
  isDragging.value = false
}

// Touch handlers for mobile pinch-zoom and pan
function getTouchDist(touches: TouchList): number {
  if (touches.length < 2) return 0
  const t0 = touches.item(0)!
  const t1 = touches.item(1)!
  const dx = t0.clientX - t1.clientX
  const dy = t0.clientY - t1.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function getTouchCenter(touches: TouchList): { x: number; y: number } {
  const t0 = touches.item(0)!
  if (touches.length < 2) {
    return { x: t0.clientX, y: t0.clientY }
  }
  const t1 = touches.item(1)!
  return {
    x: (t0.clientX + t1.clientX) / 2,
    y: (t0.clientY + t1.clientY) / 2
  }
}

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  isTouching.value = true
  const t0 = e.touches.item(0)
  if (e.touches.length === 1 && t0) {
    lastPos.value = { x: t0.clientX, y: t0.clientY }
  } else if (e.touches.length === 2) {
    lastTouchDist.value = getTouchDist(e.touches)
    lastTouchCenter.value = getTouchCenter(e.touches)
  }
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!isTouching.value) return

  const t0 = e.touches.item(0)
  if (e.touches.length === 1 && t0) {
    // Single finger pan
    const dx = t0.clientX - lastPos.value.x
    const dy = t0.clientY - lastPos.value.y
    position.value.x += dx
    position.value.y += dy
    lastPos.value = { x: t0.clientX, y: t0.clientY }
  } else if (e.touches.length === 2) {
    // Pinch zoom
    const dist = getTouchDist(e.touches)
    const center = getTouchCenter(e.touches)

    if (lastTouchDist.value > 0) {
      const zoomFactor = dist / lastTouchDist.value
      scale.value = Math.min(Math.max(scale.value * zoomFactor, 0.1), 10)
    }

    // Pan with two fingers
    position.value.x += center.x - lastTouchCenter.value.x
    position.value.y += center.y - lastTouchCenter.value.y

    lastTouchDist.value = dist
    lastTouchCenter.value = center
  }
}

function onTouchEnd(e: TouchEvent) {
  const t0 = e.touches.item(0)
  if (e.touches.length === 0) {
    isTouching.value = false
    lastTouchDist.value = 0
  } else if (e.touches.length === 1 && t0) {
    lastPos.value = { x: t0.clientX, y: t0.clientY }
    lastTouchDist.value = 0
  }
}

function resetView() {
  scale.value = 1
  position.value = { x: 0, y: 0 }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">{{ hexLabel }} — Detail Map</h3>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-zinc-500">{{ Math.round(scale * 100) }}%</span>
        <button @click="resetView" class="text-xs text-zinc-500 hover:text-white transition-colors">Reset</button>
        <button @click="emit('close')" class="text-zinc-500 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>

    <!-- Image viewer -->
    <div
      class="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <div class="w-full h-full flex items-center justify-center">
        <img
          :src="imageUrl"
          :style="{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging || isTouching ? 'none' : 'transform 0.1s ease'
          }"
          class="max-w-none pointer-events-none"
          draggable="false"
        />
      </div>
    </div>

    <!-- Controls hint -->
    <div class="text-center py-2 text-zinc-600 text-xs">
      Scroll to zoom · Drag to pan · Esc to close
    </div>
  </div>
</template>

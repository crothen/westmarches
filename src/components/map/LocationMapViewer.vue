<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { LocationFeature } from '../../types'

const props = defineProps<{
  mapUrl: string
  features: LocationFeature[]
  placingFeature: string | null
  isInteractive?: boolean
}>()

const emit = defineEmits<{
  'place': [featureId: string, x: number, y: number]
  'click-feature': [feature: LocationFeature]
  'map-click': [x: number, y: number]
}>()

const typeIcons: Record<string, string> = {
  inn: '🍺', shop: '🛒', temple: '⛪', shrine: '🕯️', blacksmith: '⚒️', tavern: '🍻', guild: '🏛️',
  market: '🛍️', gate: '🚪', tower: '🗼', ruins: '🏚️', cave: '🕳️', bridge: '🌉',
  well: '💧', monument: '🗿', graveyard: '⚰️', dock: '⚓', warehouse: '📦',
  barracks: '⚔️', library: '📚', other: '📌'
}

const container = ref<HTMLElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)

// Camera state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, panX: 0, panY: 0 })

// Tooltip
const hoveredFeature = ref<LocationFeature | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5

const placedFeatures = computed(() => props.features.filter(f => f.mapPosition))

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = container.value!.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const prevZoom = zoom.value
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.value * delta))

  // Zoom towards cursor
  const scale = newZoom / prevZoom
  panX.value = mouseX - scale * (mouseX - panX.value)
  panY.value = mouseY - scale * (mouseY - panY.value)
  zoom.value = newZoom
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  // If placing a feature, handle the click instead
  if (props.placingFeature) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  panX.value = dragStart.value.panX + (e.clientX - dragStart.value.x)
  panY.value = dragStart.value.panY + (e.clientY - dragStart.value.y)
}

function onMouseUp() {
  isDragging.value = false
}

function onMapClick(e: MouseEvent) {
  if (!props.placingFeature) {
    // Check if we should emit a general map click for adding new POI
    const pos = getMapPosition(e)
    if (pos) emit('map-click', pos.x, pos.y)
    return
  }

  const pos = getMapPosition(e)
  if (pos) {
    emit('place', props.placingFeature, pos.x, pos.y)
  }
}

function getMapPosition(e: MouseEvent): { x: number; y: number } | null {
  if (!imgEl.value || !container.value) return null
  const rect = container.value.getBoundingClientRect()
  
  // Get click position relative to the actual image in its transformed state
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top

  // Reverse the transform to get position relative to the original image
  const imgX = (clickX - panX.value) / zoom.value
  const imgY = (clickY - panY.value) / zoom.value

  // Convert to percentage of image dimensions
  const imgWidth = imgEl.value.naturalWidth * (container.value.clientWidth / imgEl.value.naturalWidth)
  const imgHeight = imgEl.value.naturalHeight * (container.value.clientWidth / imgEl.value.naturalWidth)

  const x = (imgX / imgWidth) * 100
  const y = (imgY / imgHeight) * 100

  if (x < 0 || x > 100 || y < 0 || y > 100) return null
  return { x, y }
}

function onFeatureHover(e: MouseEvent, feat: LocationFeature) {
  hoveredFeature.value = feat
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onFeatureLeave() {
  hoveredFeature.value = null
}

function onFeatureClick(e: MouseEvent, feat: LocationFeature) {
  e.stopPropagation()
  emit('click-feature', feat)
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div class="relative">
    <!-- Controls -->
    <div class="absolute top-2 right-2 z-20 flex gap-1">
      <button @click="zoom = Math.min(MAX_ZOOM, zoom * 1.3)" class="w-7 h-7 rounded-lg bg-black/60 backdrop-blur text-zinc-300 hover:text-white text-sm flex items-center justify-center transition-colors border border-white/10">+</button>
      <button @click="zoom = Math.max(MIN_ZOOM, zoom / 1.3)" class="w-7 h-7 rounded-lg bg-black/60 backdrop-blur text-zinc-300 hover:text-white text-sm flex items-center justify-center transition-colors border border-white/10">−</button>
      <button @click="resetView" class="w-7 h-7 rounded-lg bg-black/60 backdrop-blur text-zinc-300 hover:text-white text-[0.6rem] flex items-center justify-center transition-colors border border-white/10" title="Reset view">⟲</button>
    </div>

    <!-- Zoom level indicator -->
    <div v-if="zoom !== 1" class="absolute top-2 left-2 z-20 text-[0.6rem] text-zinc-400 bg-black/60 backdrop-blur px-2 py-0.5 rounded-lg border border-white/10">
      {{ Math.round(zoom * 100) }}%
    </div>

    <!-- Map container -->
    <div
      ref="container"
      :class="['relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950 select-none', placingFeature ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab']"
      style="height: 500px"
      @wheel="onWheel"
      @mousedown="onMouseDown"
      @click="onMapClick"
    >
      <!-- Transformed layer -->
      <div
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          position: 'relative'
        }"
      >
        <img
          ref="imgEl"
          :src="mapUrl"
          class="w-full pointer-events-none"
          draggable="false"
        />

        <!-- Feature markers (positioned on the image) -->
        <div
          v-for="feat in placedFeatures" :key="feat.id"
          class="absolute flex items-center justify-center transition-transform hover:scale-110"
          :style="{
            left: feat.mapPosition!.x + '%',
            top: feat.mapPosition!.y + '%',
            transform: `translate(-50%, -50%) scale(${1 / zoom})`,
            fontSize: `${Math.max(14, 20 / zoom)}px`,
            zIndex: hoveredFeature?.id === feat.id ? 30 : 10
          }"
          @mouseenter="onFeatureHover($event, feat)"
          @mouseleave="onFeatureLeave"
          @click="onFeatureClick($event, feat)"
        >
          <span class="drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] cursor-pointer">{{ typeIcons[feat.type] || '📌' }}</span>
        </div>
      </div>
    </div>

    <!-- Placing indicator -->
    <div v-if="placingFeature" class="mt-2 text-xs text-[#ef233c] animate-pulse">
      Click on the map to place the feature...
      <button @click="$emit('place', '', 0, 0)" class="text-zinc-500 ml-2 hover:text-white">Cancel</button>
    </div>

    <!-- Feature tooltip -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-all duration-100"
        enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-75"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div
          v-if="hoveredFeature"
          class="fixed z-[100] bg-zinc-900 border border-white/10 rounded-lg shadow-2xl p-2.5 pointer-events-none max-w-48"
          :style="{ left: (tooltipPos.x + 12) + 'px', top: (tooltipPos.y - 10) + 'px' }"
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-sm">{{ typeIcons[hoveredFeature.type] || '📌' }}</span>
            <span class="text-xs font-semibold text-white" style="font-family: Manrope, sans-serif">{{ hoveredFeature.name }}</span>
          </div>
          <span class="text-[0.6rem] text-zinc-500">{{ hoveredFeature.type }}</span>
          <p v-if="hoveredFeature.description" class="text-[0.65rem] text-zinc-400 mt-1 line-clamp-2">{{ hoveredFeature.description }}</p>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

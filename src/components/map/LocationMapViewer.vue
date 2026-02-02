<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { LocationFeature, CampaignLocation } from '../../types'

const props = defineProps<{
  mapUrl: string
  features: LocationFeature[]
  subLocations?: CampaignLocation[]
  placingFeature: string | null
  placingSubLocation?: string | null
  isInteractive?: boolean
  highlightedFeatureId?: string | null
  highlightedSubLocationId?: string | null
  maxHeight?: number
}>()

const emit = defineEmits<{
  'place': [featureId: string, x: number, y: number]
  'place-sublocation': [locationId: string, x: number, y: number]
  'click-feature': [feature: LocationFeature]
  'click-sublocation': [location: CampaignLocation]
  'map-click': [x: number, y: number]
}>()

import { useTypeConfig } from '../../composables/useTypeConfig'
const { getIconUrl } = useTypeConfig()

const container = ref<HTMLElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const imgAspect = ref(0)

// Camera state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, panX: 0, panY: 0 })

// Touch state
const touchStartPos = ref({ x: 0, y: 0 })
const touchHasMoved = ref(false)
const lastTouchDist = ref(0)
const lastTouchCenter = ref({ x: 0, y: 0 })
const isTouching = ref(false)

// Tooltip
const hoveredFeature = ref<LocationFeature | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

const MIN_ZOOM = 0.5
const MAX_ZOOM = 20

const placedFeatures = computed(() => props.features.filter(f => f.mapPosition))
const placedSubLocations = computed(() => (props.subLocations || []).filter(l => l.mapPosition))
const isPlacing = computed(() => !!props.placingFeature || !!props.placingSubLocation)

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

const mouseHasDragged = ref(false)

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging.value = true
  mouseHasDragged.value = false
  dragStart.value = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const dx = e.clientX - dragStart.value.x
  const dy = e.clientY - dragStart.value.y
  if (Math.hypot(dx, dy) > 5) mouseHasDragged.value = true
  panX.value = dragStart.value.panX + dx
  panY.value = dragStart.value.panY + dy
}

function onMouseUp() {
  isDragging.value = false
}

function onMapClick(e: MouseEvent) {
  if (mouseHasDragged.value) return

  if (props.placingFeature) {
    const pos = getMapPosition(e)
    if (pos) emit('place', props.placingFeature, pos.x, pos.y)
    return
  }

  if (props.placingSubLocation) {
    const pos = getMapPosition(e)
    if (pos) emit('place-sublocation', props.placingSubLocation, pos.x, pos.y)
    return
  }

  const pos = getMapPosition(e)
  if (pos) emit('map-click', pos.x, pos.y)
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

function onSubLocationHover(e: MouseEvent, loc: CampaignLocation) {
  hoveredFeature.value = { id: loc.id, name: loc.name, type: loc.type as any, description: loc.description } as any
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onSubLocationClick(e: MouseEvent, loc: CampaignLocation) {
  e.stopPropagation()
  emit('click-sublocation', loc)
}

// --- Touch handlers ---
function getTouchDist(touches: TouchList): number {
  if (touches.length < 2) return 0
  const t0 = touches[0]!, t1 = touches[1]!
  return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
}

function getTouchCenter(touches: TouchList): { x: number; y: number } {
  const t0 = touches[0]!
  if (touches.length < 2) return { x: t0.clientX, y: t0.clientY }
  const t1 = touches[1]!
  return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 }
}

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  isTouching.value = true
  touchHasMoved.value = false
  const t0 = e.touches[0]!
  if (e.touches.length === 1) {
    touchStartPos.value = { x: t0.clientX, y: t0.clientY }
    dragStart.value = { x: t0.clientX, y: t0.clientY, panX: panX.value, panY: panY.value }
  } else if (e.touches.length === 2) {
    touchHasMoved.value = true // multi-touch = no tap
    lastTouchDist.value = getTouchDist(e.touches)
    lastTouchCenter.value = getTouchCenter(e.touches)
  }
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!isTouching.value) return

  if (e.touches.length === 1) {
    const t0 = e.touches[0]!
    const dx = t0.clientX - touchStartPos.value.x
    const dy = t0.clientY - touchStartPos.value.y
    if (Math.hypot(dx, dy) > 5) touchHasMoved.value = true
    panX.value = dragStart.value.panX + (t0.clientX - dragStart.value.x)
    panY.value = dragStart.value.panY + (t0.clientY - dragStart.value.y)
  } else if (e.touches.length === 2) {
    const dist = getTouchDist(e.touches)
    const center = getTouchCenter(e.touches)
    const rect = container.value!.getBoundingClientRect()

    if (lastTouchDist.value > 0) {
      const prevZoom = zoom.value
      const scale = dist / lastTouchDist.value
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.value * scale))
      const zoomScale = newZoom / prevZoom
      const cx = center.x - rect.left
      const cy = center.y - rect.top
      panX.value = cx - zoomScale * (cx - panX.value)
      panY.value = cy - zoomScale * (cy - panY.value)
      zoom.value = newZoom
    }

    // Pan with two fingers
    panX.value += center.x - lastTouchCenter.value.x
    panY.value += center.y - lastTouchCenter.value.y

    lastTouchDist.value = dist
    lastTouchCenter.value = center
  }
}

function onTouchEnd(e: TouchEvent) {
  if (e.touches.length === 0) {
    // Single tap = click
    if (!touchHasMoved.value && e.changedTouches.length > 0) {
      const t = e.changedTouches[0]!
      // Check if tap hit a feature marker first
      const tappedFeat = getFeatureAtTouch(t)
      const tappedSubLoc = !tappedFeat ? getSubLocationAtTouch(t) : null
      if (tappedFeat) {
        emit('click-feature', tappedFeat)
      } else if (tappedSubLoc) {
        emit('click-sublocation', tappedSubLoc)
      } else {
        const pos = getTouchMapPosition(t)
        if (pos) {
          if (props.placingFeature) {
            emit('place', props.placingFeature, pos.x, pos.y)
          } else if (props.placingSubLocation) {
            emit('place-sublocation', props.placingSubLocation, pos.x, pos.y)
          } else {
            emit('map-click', pos.x, pos.y)
          }
        }
      }
    }
    isTouching.value = false
    lastTouchDist.value = 0
  } else if (e.touches.length === 1) {
    const t0 = e.touches[0]!
    dragStart.value = { x: t0.clientX, y: t0.clientY, panX: panX.value, panY: panY.value }
    lastTouchDist.value = 0
  }
}

function getFeatureAtTouch(touch: Touch): LocationFeature | null {
  if (!container.value || !imgEl.value) return null
  const rect = container.value.getBoundingClientRect()
  const clickX = touch.clientX - rect.left
  const clickY = touch.clientY - rect.top
  const imgX = (clickX - panX.value) / zoom.value
  const imgY = (clickY - panY.value) / zoom.value
  const imgWidth = container.value.clientWidth
  const imgHeight = imgEl.value.naturalHeight * (container.value.clientWidth / imgEl.value.naturalWidth)
  const pctX = (imgX / imgWidth) * 100
  const pctY = (imgY / imgHeight) * 100

  // Hit test: find closest feature within a tap radius
  const tapRadius = 3 / zoom.value // ~3% of image at current zoom
  let closest: LocationFeature | null = null
  let closestDist = Infinity
  for (const feat of placedFeatures.value) {
    const dx = pctX - feat.mapPosition!.x
    const dy = pctY - feat.mapPosition!.y
    const dist = Math.hypot(dx, dy)
    if (dist < tapRadius && dist < closestDist) {
      closest = feat
      closestDist = dist
    }
  }
  return closest
}

function getSubLocationAtTouch(touch: Touch): CampaignLocation | null {
  if (!container.value || !imgEl.value) return null
  const rect = container.value.getBoundingClientRect()
  const clickX = touch.clientX - rect.left
  const clickY = touch.clientY - rect.top
  const imgX = (clickX - panX.value) / zoom.value
  const imgY = (clickY - panY.value) / zoom.value
  const imgWidth = container.value.clientWidth
  const imgHeight = imgEl.value.naturalHeight * (container.value.clientWidth / imgEl.value.naturalWidth)
  const pctX = (imgX / imgWidth) * 100
  const pctY = (imgY / imgHeight) * 100

  const tapRadius = 3 / zoom.value
  let closest: CampaignLocation | null = null
  let closestDist = Infinity
  for (const loc of placedSubLocations.value) {
    const dx = pctX - loc.mapPosition!.x
    const dy = pctY - loc.mapPosition!.y
    const dist = Math.hypot(dx, dy)
    if (dist < tapRadius && dist < closestDist) {
      closest = loc
      closestDist = dist
    }
  }
  return closest
}

function getTouchMapPosition(touch: Touch): { x: number; y: number } | null {
  if (!imgEl.value || !container.value) return null
  const rect = container.value.getBoundingClientRect()
  const clickX = touch.clientX - rect.left
  const clickY = touch.clientY - rect.top
  const imgX = (clickX - panX.value) / zoom.value
  const imgY = (clickY - panY.value) / zoom.value
  const imgWidth = imgEl.value.naturalWidth * (container.value.clientWidth / imgEl.value.naturalWidth)
  const imgHeight = imgEl.value.naturalHeight * (container.value.clientWidth / imgEl.value.naturalWidth)
  const x = (imgX / imgWidth) * 100
  const y = (imgY / imgHeight) * 100
  if (x < 0 || x > 100 || y < 0 || y > 100) return null
  return { x, y }
}

function onImageLoad() {
  if (!imgEl.value) return
  imgAspect.value = imgEl.value.naturalHeight / imgEl.value.naturalWidth
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
      :class="['relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950 select-none touch-none', isPlacing ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab']"
      :style="imgAspect ? { aspectRatio: `1 / ${imgAspect}`, maxHeight: '80vh', maxWidth: 'calc(100% - 2rem)' } : { height: '300px' }"
      @wheel="onWheel"
      @mousedown="onMouseDown"
      @click="onMapClick"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
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
          @load="onImageLoad"
        />

        <!-- Sub-location markers (positioned on the image) -->
        <div
          v-for="loc in placedSubLocations" :key="'loc-' + loc.id"
          :class="['absolute flex items-center justify-center hover:scale-110']"
          :style="{
            left: loc.mapPosition!.x + '%',
            top: loc.mapPosition!.y + '%',
            width: `${(highlightedSubLocationId === loc.id ? 36 : 28) / zoom}px`,
            height: `${(highlightedSubLocationId === loc.id ? 36 : 28) / zoom}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: hoveredFeature?.id === loc.id || highlightedSubLocationId === loc.id ? 30 : 15,
            transition: 'filter 0.2s, width 0.2s, height 0.2s'
          }"
          @mouseenter="onSubLocationHover($event, loc)"
          @mouseleave="onFeatureLeave"
          @click="onSubLocationClick($event, loc)"
        >
          <img :src="getIconUrl(loc.type)" :class="['cursor-pointer transition-all duration-200 w-full h-full object-contain', highlightedSubLocationId === loc.id ? 'drop-shadow-[0_0_8px_rgba(239,35,60,0.8)]' : 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]']" />
        </div>

        <!-- Feature markers (positioned on the image) -->
        <div
          v-for="feat in placedFeatures" :key="feat.id"
          :class="['absolute flex items-center justify-center hover:scale-110']"
          :style="{
            left: feat.mapPosition!.x + '%',
            top: feat.mapPosition!.y + '%',
            width: `${(highlightedFeatureId === feat.id ? 32 : 24) / zoom}px`,
            height: `${(highlightedFeatureId === feat.id ? 32 : 24) / zoom}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: hoveredFeature?.id === feat.id || highlightedFeatureId === feat.id ? 30 : 10,
            transition: 'filter 0.2s, width 0.2s, height 0.2s'
          }"
          @mouseenter="onFeatureHover($event, feat)"
          @mouseleave="onFeatureLeave"
          @click="onFeatureClick($event, feat)"
        >
          <img :src="getIconUrl(feat.type)" :class="['cursor-pointer transition-all duration-200 w-full h-full object-contain', highlightedFeatureId === feat.id ? 'drop-shadow-[0_0_8px_rgba(239,35,60,0.8)]' : 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]']" />
        </div>
      </div>
    </div>

    <!-- Placing indicator -->
    <div v-if="isPlacing" class="mt-2 text-xs text-[#ef233c] animate-pulse">
      Click on the map to place the {{ placingSubLocation ? 'location' : 'feature' }}...
      <button v-if="placingFeature" @click="$emit('place', '', 0, 0)" class="text-zinc-500 ml-2 hover:text-white">Cancel</button>
      <button v-if="placingSubLocation" @click="$emit('place-sublocation', '', 0, 0)" class="text-zinc-500 ml-2 hover:text-white">Cancel</button>
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
            <img :src="getIconUrl(hoveredFeature.type)" class="w-4 h-4 object-contain" />
            <span class="text-xs font-semibold text-white" style="font-family: Manrope, sans-serif">{{ hoveredFeature.name }}</span>
          </div>
          <span class="text-[0.6rem] text-zinc-500">{{ hoveredFeature.type }}</span>
          <p v-if="hoveredFeature.description" class="text-[0.65rem] text-zinc-400 mt-1 line-clamp-2">{{ hoveredFeature.description }}</p>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

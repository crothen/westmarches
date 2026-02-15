<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import HexGrid from '../components/map/HexGrid.vue'
import HexDetailPanel from '../components/map/HexDetailPanel.vue'
import { useMapData } from '../composables/useMapData'
import { usePwa } from '../composables/usePwa'

const route = useRoute()
const router = useRouter()
const { isPwa } = usePwa()
const selectedHex = ref<{ x: number; y: number } | null>(null)
const hexGridRef = ref<InstanceType<typeof HexGrid> | null>(null)
const { hexData, terrainConfig, tagsConfig } = useMapData()
const mapDocRef = doc(db, 'maps', 'world')

// Parse initial hex from URL query (?hex=5_10)
const initialHex = computed(() => {
  const param = route.query.hex
  if (param && typeof param === 'string') {
    const parts = param.split('_').map(Number)
    if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
      return { x: parts[0]!, y: parts[1]! }
    }
  }
  return null
})

// Set selectedHex from URL on first load
if (initialHex.value) {
  selectedHex.value = initialHex.value
}

function onHexClick(hex: { x: number; y: number }) {
  selectedHex.value = hex
  // Replace URL silently — no history entry per click, no zoom/jump
  router.replace({ query: { hex: `${hex.x}_${hex.y}` } })
}

function closePanel() {
  selectedHex.value = null
  router.replace({ query: {} })
}

async function updateTerrain(hexKey: string, terrainId: number) {
  try {
    await updateDoc(mapDocRef, { [`hexes.${hexKey}.type`]: terrainId })
  } catch (e) {
    console.error('Failed to update terrain:', e)
  }
}

async function setMainTag(hexKey: string, tagId: number | null, isPrivate: boolean) {
  try {
    await updateDoc(mapDocRef, {
      [`hexes.${hexKey}.mainTag`]: tagId,
      [`hexes.${hexKey}.mainTagIsPrivate`]: isPrivate
    })
  } catch (e) {
    console.error('Failed to set main tag:', e)
  }
}

async function updateDetailMap(hexKey: string, url: string | null) {
  try {
    if (url) {
      await updateDoc(mapDocRef, { [`hexes.${hexKey}.detailMapUrl`]: url })
    } else {
      await updateDoc(mapDocRef, { [`hexes.${hexKey}.detailMapUrl`]: null })
    }
  } catch (e) {
    console.error('Failed to update detail map:', e)
  }
}

function onMarkersChanged() {
  hexGridRef.value?.refreshMarkers()
}

async function toggleTag(hexKey: string, tagId: number) {
  const currentTags = hexData.value[hexKey]?.tags || []
  let newTags: number[]
  if (currentTags.includes(tagId)) {
    newTags = currentTags.filter((t: number) => t !== tagId)
  } else {
    if (currentTags.length >= 6) {
      alert('Max 6 side tags allowed!')
      return
    }
    newTags = [...currentTags, tagId]
  }
  try {
    await updateDoc(mapDocRef, { [`hexes.${hexKey}.tags`]: newTags })
  } catch (e) {
    console.error('Failed to toggle tag:', e)
  }
}
</script>

<template>
  <!-- PWA Fullscreen Mode -->
  <div v-if="isPwa" class="fixed inset-0 bg-black flex flex-col" style="padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px))">
    <!-- Floating header -->
    <div class="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none" style="top: calc(12px + env(safe-area-inset-top, 0px))">
      <div class="flex items-center gap-2 pointer-events-auto">
        <router-link 
          to="/"
          class="w-10 h-10 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
        >
          ←
        </router-link>
        <h1 class="text-lg font-bold tracking-tight text-white px-3 py-2 bg-zinc-900/90 border border-zinc-700 rounded-lg" style="font-family: Manrope, sans-serif">
          🗺️ Map
        </h1>
      </div>
      <div v-if="selectedHex" class="text-zinc-400 text-sm bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-2 pointer-events-auto">
        <span class="text-[#ef233c] font-mono">{{ selectedHex.x }}, {{ selectedHex.y }}</span>
      </div>
    </div>

    <!-- Full Map -->
    <HexGrid 
      ref="hexGridRef" 
      :initial-hex="initialHex" 
      @hex-click="onHexClick" 
      class="flex-1" 
    />

    <!-- Detail panel (slides in from right) -->
    <transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <div v-if="selectedHex" class="absolute top-0 right-0 h-full" style="padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px))">
        <HexDetailPanel
          :hex="selectedHex"
          :terrain-config="terrainConfig"
          :tags-config="tagsConfig"
          :hex-data="hexData"
          @close="closePanel"
          @update-terrain="updateTerrain"
          @set-main-tag="setMainTag"
          @toggle-tag="toggleTag"
          @update-detail-map="updateDetailMap"
          @markers-changed="onMarkersChanged"
        />
      </div>
    </transition>
  </div>

  <!-- Regular Mode -->
  <div v-else class="h-[calc(100vh-3rem)] flex">
    <!-- Map area -->
    <div class="flex-1 flex flex-col min-w-0">
      <div class="flex items-center justify-between mb-3 px-1">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">🗺️ World Map</h1>
          <div class="flex gap-1">
            <router-link 
              :to="{ name: 'map-fullscreen', query: route.query }"
              class="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
              title="Fullscreen (90%)"
            >
              ⛶
            </router-link>
            <router-link 
              :to="{ name: 'map-wc' }"
              class="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
              title="Test Web Component"
            >
              🧪
            </router-link>
          </div>
        </div>
        <div v-if="selectedHex" class="text-zinc-500 text-sm">
          <span class="text-[#ef233c] font-mono">{{ selectedHex.x }}, {{ selectedHex.y }}</span>
        </div>
      </div>
      <HexGrid ref="hexGridRef" :initial-hex="initialHex" @hex-click="onHexClick" class="flex-1 rounded-xl overflow-hidden" />
    </div>

    <!-- Detail panel (slides in from right) -->
    <transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <HexDetailPanel
        v-if="selectedHex"
        :hex="selectedHex"
        :terrain-config="terrainConfig"
        :tags-config="tagsConfig"
        :hex-data="hexData"
        @close="closePanel"
        @update-terrain="updateTerrain"
        @set-main-tag="setMainTag"
        @toggle-tag="toggleTag"
        @update-detail-map="updateDetailMap"
        @markers-changed="onMarkersChanged"
      />
    </transition>
  </div>
</template>

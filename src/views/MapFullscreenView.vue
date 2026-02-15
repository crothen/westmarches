<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import HexGrid from '../components/map/HexGrid.vue'
import HexDetailPanel from '../components/map/HexDetailPanel.vue'
import { useMapData } from '../composables/useMapData'

const route = useRoute()
const router = useRouter()
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

if (initialHex.value) {
  selectedHex.value = initialHex.value
}

function onHexClick(hex: { x: number; y: number }) {
  selectedHex.value = hex
  router.replace({ query: { hex: `${hex.x}_${hex.y}` } })
}

function closePanel() {
  selectedHex.value = null
  router.replace({ query: {} })
}

function exitFullscreen() {
  router.push({ name: 'map', query: route.query })
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
  <div class="fixed inset-0 bg-black flex z-50">
    <!-- Map area - 90% of viewport -->
    <div class="flex-1 flex flex-col min-w-0 h-[90vh] m-auto relative">
      <!-- Top bar -->
      <div class="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div class="flex items-center gap-3 pointer-events-auto">
          <button 
            @click="exitFullscreen"
            class="px-3 py-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>←</span>
            <span>Exit Fullscreen</span>
          </button>
          <h1 class="text-xl font-bold tracking-tight text-white px-3 py-2 bg-zinc-900/90 border border-zinc-700 rounded-lg" style="font-family: Manrope, sans-serif">
            🗺️ World Map
          </h1>
        </div>
        <div v-if="selectedHex" class="text-zinc-400 text-sm bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-2 pointer-events-auto">
          Hex: <span class="text-[#ef233c] font-mono">{{ selectedHex.x }}, {{ selectedHex.y }}</span>
        </div>
      </div>

      <!-- Map -->
      <HexGrid 
        ref="hexGridRef" 
        :initial-hex="initialHex" 
        @hex-click="onHexClick" 
        class="flex-1 rounded-xl overflow-hidden border border-zinc-800" 
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
        <div v-if="selectedHex" class="absolute top-0 right-0 h-full">
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
  </div>
</template>

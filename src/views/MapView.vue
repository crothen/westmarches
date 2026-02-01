<script setup lang="ts">
import { ref } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import HexGrid from '../components/map/HexGrid.vue'
import HexDetailPanel from '../components/map/HexDetailPanel.vue'
import { useMapData } from '../composables/useMapData'

const selectedHex = ref<{ x: number; y: number } | null>(null)
const { hexData, terrainConfig, tagsConfig } = useMapData()
const mapDocRef = doc(db, 'maps', 'world')

function onHexClick(hex: { x: number; y: number }) {
  selectedHex.value = hex
}

function closePanel() {
  selectedHex.value = null
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
  <div class="h-[calc(100vh-5rem)] flex">
    <!-- Map area -->
    <div class="flex-1 flex flex-col min-w-0">
      <div class="flex items-center justify-between mb-3 px-1">
        <h1 class="text-2xl font-bold text-slate-100">🗺️ World Map</h1>
        <div v-if="selectedHex" class="text-slate-400 text-sm">
          <span class="text-amber-500 font-mono">{{ selectedHex.x }}, {{ selectedHex.y }}</span>
        </div>
      </div>
      <HexGrid @hex-click="onHexClick" class="flex-1 rounded-xl overflow-hidden" />
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
      />
    </transition>
  </div>
</template>

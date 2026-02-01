<script setup lang="ts">
import { ref } from 'vue'
import HexGrid from '../components/map/HexGrid.vue'

const selectedHex = ref<{ x: number; y: number } | null>(null)

function onHexClick(hex: { x: number; y: number }) {
  selectedHex.value = hex
}
</script>

<template>
  <div class="h-[calc(100vh-8rem)]">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-3xl font-bold text-amber-500">🗺️ World Map</h1>
      <div v-if="selectedHex" class="text-stone-400 text-sm">
        Selected: <span class="text-amber-500 font-mono">{{ selectedHex.x }}, {{ selectedHex.y }}</span>
      </div>
    </div>
    <HexGrid @hex-click="onHexClick" class="flex-1" />
  </div>
</template>

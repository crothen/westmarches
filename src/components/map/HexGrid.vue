<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { HexMap } from '../../lib/hexMap'
import { MAP_CONFIG } from '../../lib/mapData'
import { useMapData } from '../../composables/useMapData'
import { useAuthStore } from '../../stores/auth'

const emit = defineEmits<{
  'hex-click': [hex: { x: number; y: number }]
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const { hexData, terrainConfig, tagsConfig, loading } = useMapData()
const auth = useAuthStore()
let hexMap: HexMap | null = null

const selectedHex = ref<{ x: number; y: number } | null>(null)

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  // Wait for configs to load, then init
  const stopWatch = watch([terrainConfig, tagsConfig], ([tc, tg]) => {
    if (Object.keys(tc).length && Object.keys(tg).length && !hexMap) {
      hexMap = new HexMap(
        canvasRef.value!,
        containerRef.value!,
        MAP_CONFIG,
        tc,
        tg
      )
      hexMap.onHexClick = (hex: any, _x: number, _y: number, type: string) => {
        if (type === 'click' && hex) {
          selectedHex.value = hex
          emit('hex-click', hex)
        }
      }
      hexMap.onCameraChange = () => {
        hexMap?.draw(hexData.value, selectedHex.value, false, auth.role)
      }
      hexMap.draw(hexData.value, selectedHex.value, false, auth.role)
      stopWatch()
    }
  }, { immediate: true })
})

watch([hexData, selectedHex], () => {
  if (hexMap) {
    hexMap.draw(hexData.value, selectedHex.value, false, auth.role)
  }
})

onUnmounted(() => {
  if (hexMap) {
    hexMap.destroy()
    hexMap = null
  }
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full min-h-[500px] relative bg-stone-900 rounded-lg overflow-hidden">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <span class="text-amber-500 animate-pulse">Loading map...</span>
    </div>
    <canvas ref="canvasRef" class="block w-full h-full" />
  </div>
</template>

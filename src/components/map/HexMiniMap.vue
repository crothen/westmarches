<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useMapData } from '../../composables/useMapData'
import { MAP_CONFIG } from '../../lib/mapData'

const props = withDefaults(defineProps<{
  hexKey: string
  width?: number
}>(), {
  width: 280
})

const { hexData, terrainConfig } = useMapData()
const canvasRef = ref<HTMLCanvasElement>()

function getHexCenter(col: number, row: number, hexSize: number): { x: number; y: number } {
  const c = col - 1
  const r = row - 1
  const x = c * 1.5 * hexSize + hexSize * 2
  const yOffset = (c % 2) * ((Math.sqrt(3) * hexSize) / 2)
  const y = r * Math.sqrt(3) * hexSize + yOffset + hexSize * 2
  return { x, y }
}

function drawMiniMap() {
  const canvas = canvasRef.value
  if (!canvas || !Object.keys(terrainConfig.value).length) return

  // Parse target hex
  const parts = props.hexKey.split('_')
  const targetCol = parseInt(parts[0]!)
  const targetRow = parseInt(parts[1]!)
  if (isNaN(targetCol) || isNaN(targetRow)) return

  // Calculate hex size to fit entire grid into canvas
  const gridW = MAP_CONFIG.gridW
  const gridH = MAP_CONFIG.gridH
  const canvasW = props.width
  // hexSize based on fitting all columns: totalWidth ≈ gridW * 1.5 * hexSize + 4 * hexSize
  const hexSize = canvasW / (gridW * 1.5 + 4)
  // Calculate canvas height from hex size
  const canvasH = Math.ceil((gridH + 1) * Math.sqrt(3) * hexSize + hexSize * 4)

  const dpr = window.devicePixelRatio || 1
  canvas.width = canvasW * dpr
  canvas.height = canvasH * dpr
  canvas.style.width = `${canvasW}px`
  canvas.style.height = `${canvasH}px`

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // Build terrain color map
  const terrainColors: Record<number, string> = {}
  const defaultColors: Record<string, string> = {
    'Water': '#2563eb', 'Deep Water': '#1e3a8a', 'Forest': '#166534',
    'Dark Forest': '#14532d', 'Mountain': '#78716c', 'Swamp': '#4a5568',
    'Plains': '#a3e635', 'Foothills': '#92806c', 'Volcano': '#991b1b',
    'Pale': '#e2e8f0', 'Grass': '#65a30d', 'Dark Grass': '#4d7c0f',
    'Desert': '#d4a574', 'Wasteland': '#737373', 'Lava': '#dc2626',
    'Lava Rock': '#44403c', 'Ice': '#bae6fd'
  }
  for (const [name, conf] of Object.entries(terrainConfig.value)) {
    const id = (conf as any).id
    if (id) terrainColors[id] = (conf as any).color || defaultColors[name] || '#789'
  }

  // Fill background
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, canvasW, canvasH)

  const angle = (2 * Math.PI) / 6

  // Draw all hexes
  for (let col = 1; col <= gridW; col++) {
    for (let row = 1; row <= gridH; row++) {
      const center = getHexCenter(col, row, hexSize)
      const key = `${col}_${row}`
      const data = hexData.value[key] || {}

      let typeId = 1
      if (typeof data.type === 'number') typeId = data.type
      else if (typeof data.type === 'string') {
        for (const [name, conf] of Object.entries(terrainConfig.value)) {
          if (name === data.type && (conf as any).id) { typeId = (conf as any).id; break }
        }
      }

      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const px = center.x + hexSize * 0.98 * Math.cos(angle * i)
        const py = center.y + hexSize * 0.98 * Math.sin(angle * i)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()

      ctx.fillStyle = terrainColors[typeId] || '#789'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.lineWidth = 0.3
      ctx.stroke()
    }
  }

  // Draw reticle/crosshair on target hex
  const targetCenter = getHexCenter(targetCol, targetRow, hexSize)
  const r = hexSize * 2.8 // radius of the reticle circle
  const gap = hexSize * 1.0 // gap in crosshair lines near center
  const armLen = hexSize * 4.4 // length of crosshair arms

  ctx.save()
  ctx.strokeStyle = '#ef233c'
  ctx.lineWidth = 1.5
  ctx.shadowColor = '#ef233c'
  ctx.shadowBlur = 6

  // Outer circle
  ctx.beginPath()
  ctx.arc(targetCenter.x, targetCenter.y, r, 0, Math.PI * 2)
  ctx.stroke()

  // Inner circle (smaller)
  ctx.beginPath()
  ctx.arc(targetCenter.x, targetCenter.y, r * 0.45, 0, Math.PI * 2)
  ctx.stroke()

  // Crosshair arms (4 lines with gap near center)
  const arms = [
    { dx: 1, dy: 0 }, // right
    { dx: -1, dy: 0 }, // left
    { dx: 0, dy: 1 }, // down
    { dx: 0, dy: -1 }, // up
  ]
  for (const arm of arms) {
    ctx.beginPath()
    ctx.moveTo(targetCenter.x + arm.dx * gap, targetCenter.y + arm.dy * gap)
    ctx.lineTo(targetCenter.x + arm.dx * armLen, targetCenter.y + arm.dy * armLen)
    ctx.stroke()
  }

  ctx.restore()
}

onMounted(() => drawMiniMap())
watch([hexData, terrainConfig, () => props.hexKey], () => drawMiniMap())
</script>

<template>
  <canvas ref="canvasRef" class="block rounded-lg" />
</template>

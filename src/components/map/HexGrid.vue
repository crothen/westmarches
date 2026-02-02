<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { collection, query, addDoc, deleteDoc, updateDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { HexMap } from '../../lib/hexMap'
import type { HexMarkerData, MapPath, MapPathType } from '../../lib/hexMap'
import { MAP_CONFIG } from '../../lib/mapData'
import { useMapData } from '../../composables/useMapData'
import { useTypeConfig } from '../../composables/useTypeConfig'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{
  initialHex?: { x: number; y: number } | null
}>()

const emit = defineEmits<{
  'hex-click': [hex: { x: number; y: number }]
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const { hexData, terrainConfig, tagsConfig, loading } = useMapData()
const { locationTypes, featureTypes, pinTypes } = useTypeConfig()
const auth = useAuthStore()
let hexMap: HexMap | null = null

const selectedHex = ref<{ x: number; y: number } | null>(null)
const hexMarkers = ref<Record<string, HexMarkerData>>({})
const currentZoom = ref(1)

// === Draw mode state ===
const drawMode = ref(false)
const drawPathType = ref<MapPathType>('road-solid')
const drawingPoints = ref<{ x: number; y: number }[]>([])
const cursorWorldPos = ref<{ x: number; y: number } | null>(null)
const mapPaths = ref<MapPath[]>([])
const selectedPathId = ref<string | null>(null)

// === Waypoint dragging state ===
const draggingWaypoint = ref<{ pathId: string; pointIndex: number; points: { x: number; y: number }[] } | null>(null)

const canDraw = computed(() => auth.isDm || auth.isAdmin)

const pathTypeOptions: { value: MapPathType; label: string; icon: string }[] = [
  { value: 'road-solid', label: 'Road', icon: '━' },
  { value: 'road-dotted', label: 'Trail', icon: '┅' },
  { value: 'river-sm', label: 'Creek', icon: '〜' },
  { value: 'river', label: 'River', icon: '〰' },
  { value: 'river-lg', label: 'Wide River', icon: '≋' },
]

// === Path loading (real-time) ===
const unsubs: (() => void)[] = []

function subscribePaths() {
  const unsub = onSnapshot(query(collection(db, 'mapPaths')), (snap) => {
    mapPaths.value = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        type: data.type as MapPathType,
        points: data.points || [],
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() || new Date()
      }
    })
  }, (e) => {
    console.warn('Failed to load map paths:', e)
  })
  unsubs.push(unsub)
}

async function savePath(type: MapPathType, points: { x: number; y: number }[]) {
  if (points.length < 2) return
  try {
    await addDoc(collection(db, 'mapPaths'), {
      type,
      points,
      createdBy: auth.firebaseUser?.uid || null,
      createdAt: Timestamp.now()
    })
    // onSnapshot will update mapPaths automatically
  } catch (e) {
    console.error('Failed to save path:', e)
    alert('Failed to save path.')
  }
}

async function deletePath(pathId: string) {
  try {
    await deleteDoc(doc(db, 'mapPaths', pathId))
    // onSnapshot will update mapPaths automatically
    selectedPathId.value = null
  } catch (e) {
    console.error('Failed to delete path:', e)
  }
}

// === Draw mode interaction ===
function enterDrawMode() {
  drawMode.value = true
  drawingPoints.value = []
  cursorWorldPos.value = null
  selectedPathId.value = null
  if (hexMap) hexMap.disableLeftDragPan = true
}

function exitDrawMode() {
  drawMode.value = false
  drawingPoints.value = []
  cursorWorldPos.value = null
  selectedPathId.value = null
  if (hexMap) hexMap.disableLeftDragPan = false
  redraw()
}

function onDrawClick(e: MouseEvent) {
  if (!hexMap || !drawMode.value) return
  // If we were dragging a waypoint, the click at end of drag should be ignored
  if (draggingWaypoint.value) return

  // Right-click or ctrl+click to finish
  if (e.button === 2) {
    finishDrawing()
    return
  }
  if (e.button !== 0) return

  const world = hexMap.toWorld(e.clientX, e.clientY)

  // If not currently drawing, check if clicking near an existing path to select it
  if (drawingPoints.value.length === 0) {
    const hitPath = findPathAtWorld(world)
    if (hitPath) {
      selectedPathId.value = selectedPathId.value === hitPath.id ? null : hitPath.id
      redraw()
      return
    }
    // Click on empty space deselects
    if (selectedPathId.value) {
      selectedPathId.value = null
      redraw()
      return
    }
  }

  drawingPoints.value.push(world)
  redraw()
}

function findWaypointAtWorld(world: { x: number; y: number }, pathId: string): number {
  const path = mapPaths.value.find(p => p.id === pathId)
  if (!path) return -1
  const threshold = 8 / (hexMap?.camera.zoom || 1)
  for (let i = 0; i < path.points.length; i++) {
    const pt = path.points[i]!
    const dist = Math.hypot(world.x - pt.x, world.y - pt.y)
    if (dist < threshold) return i
  }
  return -1
}

function onDrawMouseDown(e: MouseEvent) {
  if (!hexMap || !drawMode.value || e.button !== 0) return

  // Only handle waypoint dragging when a path is selected and we're not drawing
  if (!selectedPathId.value || drawingPoints.value.length > 0) return

  const world = hexMap.toWorld(e.clientX, e.clientY)
  const wpIndex = findWaypointAtWorld(world, selectedPathId.value)
  if (wpIndex >= 0) {
    const path = mapPaths.value.find(p => p.id === selectedPathId.value)
    if (!path) return
    e.preventDefault()
    e.stopPropagation()
    draggingWaypoint.value = {
      pathId: selectedPathId.value,
      pointIndex: wpIndex,
      points: path.points.map(p => ({ ...p }))
    }
  }
}

function onDrawMouseMoveGlobal(e: MouseEvent) {
  if (!hexMap || !drawMode.value) return

  // Handle waypoint dragging
  if (draggingWaypoint.value) {
    const world = hexMap.toWorld(e.clientX, e.clientY)
    draggingWaypoint.value.points[draggingWaypoint.value.pointIndex] = world
    redraw()
    return
  }

  // Handle drawing preview cursor
  onDrawMouseMove(e)
}

async function onDrawMouseUp(_e: MouseEvent) {
  if (!draggingWaypoint.value) return

  // Save updated points to Firestore
  const { pathId, points } = draggingWaypoint.value
  try {
    await updateDoc(doc(db, 'mapPaths', pathId), { points })
  } catch (e) {
    console.error('Failed to update path:', e)
  }
  draggingWaypoint.value = null
}

function onDrawDblClick(e: MouseEvent) {
  if (!drawMode.value) return
  e.preventDefault()
  e.stopPropagation()
  // Remove the last point added by the second click of the double-click
  if (drawingPoints.value.length > 1) {
    drawingPoints.value.pop()
  }
  finishDrawing()
}

function onDrawMouseMove(e: MouseEvent) {
  if (!hexMap || !drawMode.value || drawingPoints.value.length === 0) return
  cursorWorldPos.value = hexMap.toWorld(e.clientX, e.clientY)
  redraw()
}

function onDrawContextMenu(e: MouseEvent) {
  if (drawMode.value) {
    e.preventDefault()
    if (drawingPoints.value.length > 0) {
      finishDrawing()
    }
  }
}

function onDrawKeyDown(e: KeyboardEvent) {
  if (!drawMode.value) return

  if (e.key === 'Escape') {
    if (drawingPoints.value.length > 0) {
      // Cancel current drawing
      drawingPoints.value = []
      cursorWorldPos.value = null
      redraw()
    } else {
      exitDrawMode()
    }
    return
  }

  if (e.key === 'Enter' && drawingPoints.value.length >= 2) {
    finishDrawing()
    return
  }

  if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) && drawingPoints.value.length > 0) {
    drawingPoints.value.pop()
    redraw()
    return
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedPathId.value) {
      deletePath(selectedPathId.value)
      redraw()
    }
  }
}

async function finishDrawing() {
  if (drawingPoints.value.length >= 2) {
    await savePath(drawPathType.value, [...drawingPoints.value])
  }
  drawingPoints.value = []
  cursorWorldPos.value = null
  redraw()
}

function findPathAtWorld(world: { x: number; y: number }): MapPath | null {
  // Hit-test: find closest path within a threshold
  const threshold = 15 / (hexMap?.camera.zoom || 1)
  let closest: MapPath | null = null
  let minDist = threshold

  for (const path of mapPaths.value) {
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i]!
      const b = path.points[i + 1]!
      const dist = pointToSegmentDist(world, a, b)
      if (dist < minDist) {
        minDist = dist
        closest = path
      }
    }
  }
  return closest
}

function pointToSegmentDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// === Hex markers loading (real-time) ===
// We store raw snapshot data and recompute markers when any changes
const rawLocDocs = ref<any[]>([])
const rawFeatDocs = ref<any[]>([])
const rawNoteDocs = ref<any[]>([])
const rawMarkerDocs = ref<any[]>([])

function recomputeHexMarkers() {
  const markers: Record<string, HexMarkerData> = {}
  const ensure = (key: string) => {
    if (!markers[key]) markers[key] = { icons: [] }
  }

  rawLocDocs.value.forEach(data => {
    if (!data.hexKey) return
    ensure(data.hexKey)
    markers[data.hexKey]!.icons.push({
      kind: 'location',
      type: data.type || 'other',
      order: data.mapOrder ?? undefined,
      hidden: !!data.hidden
    })
    if (data.hidden) markers[data.hexKey]!.hasHiddenItems = true
  })

  rawFeatDocs.value.forEach(data => {
    if (!data.hexKey) return
    ensure(data.hexKey)
    markers[data.hexKey]!.icons.push({
      kind: 'feature',
      type: data.type || 'other',
      order: data.mapOrder ?? undefined,
      hidden: !!data.hidden
    })
    if (data.hidden) markers[data.hexKey]!.hasHiddenItems = true
  })

  rawNoteDocs.value.forEach(data => {
    if (!data.hexKey) return
    ensure(data.hexKey)
    markers[data.hexKey]!.icons.push({ kind: 'note', type: 'note' })
  })

  const currentUid = auth.firebaseUser?.uid
  const isAdmin = auth.isAdmin
  rawMarkerDocs.value.forEach(data => {
    if (!data.hexKey) return
    if (data.locationId) return
    if (data.isPrivate && data.createdBy !== currentUid && !isAdmin) return
    ensure(data.hexKey)
    markers[data.hexKey]!.icons.push({
      kind: 'marker',
      type: data.type || 'clue',
      order: data.mapOrder ?? undefined,
      hidden: !!data.hidden
    })
    if (data.hidden) markers[data.hexKey]!.hasHiddenItems = true
  })

  hexMarkers.value = markers
}

function subscribeHexMarkers() {
  unsubs.push(onSnapshot(query(collection(db, 'locations')), (snap) => {
    rawLocDocs.value = snap.docs.map(d => d.data())
    recomputeHexMarkers()
  }, (e) => console.warn('Failed to load locations:', e)))

  unsubs.push(onSnapshot(query(collection(db, 'features')), (snap) => {
    rawFeatDocs.value = snap.docs.map(d => d.data())
    recomputeHexMarkers()
  }, (e) => console.warn('Failed to load features:', e)))

  unsubs.push(onSnapshot(query(collection(db, 'hexNotes')), (snap) => {
    rawNoteDocs.value = snap.docs.map(d => d.data())
    recomputeHexMarkers()
  }, (e) => console.warn('Failed to load hexNotes:', e)))

  unsubs.push(onSnapshot(query(collection(db, 'markers')), (snap) => {
    rawMarkerDocs.value = snap.docs.map(d => d.data())
    recomputeHexMarkers()
  }, (e) => console.warn('Failed to load markers:', e)))
}

// === Drawing helper ===
function redraw() {
  if (!hexMap) return
  const preview = drawMode.value && drawingPoints.value.length > 0
    ? { type: drawPathType.value, points: drawingPoints.value, cursor: cursorWorldPos.value || undefined }
    : undefined

  // If dragging a waypoint, use the modified points for that path
  let pathsToRender = mapPaths.value
  if (draggingWaypoint.value) {
    pathsToRender = mapPaths.value.map(p =>
      p.id === draggingWaypoint.value!.pathId
        ? { ...p, points: draggingWaypoint.value!.points }
        : p
    )
  }

  hexMap.draw(hexData.value, selectedHex.value, false, auth.role, hexMarkers.value, pathsToRender, preview, drawMode.value ? selectedPathId.value : null)
}

// === Init ===
onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  subscribeHexMarkers()
  subscribePaths()

  const stopWatch = watch([terrainConfig, tagsConfig], ([tc, tg]) => {
    if (Object.keys(tc).length && Object.keys(tg).length && !hexMap) {
      hexMap = new HexMap(
        canvasRef.value!,
        containerRef.value!,
        MAP_CONFIG,
        tc,
        tg
      )
      const markerTypesConfig = {
        locationTypes: Object.fromEntries(locationTypes.value.map(t => [t.key, { iconUrl: t.iconUrl }])),
        featureTypes: Object.fromEntries(featureTypes.value.map(t => [t.key, { iconUrl: t.iconUrl }])),
        hexMarkerTypes: Object.fromEntries(pinTypes.value.map(t => [t.key, { iconUrl: t.iconUrl }]))
      }
      if (Object.keys(markerTypesConfig.locationTypes).length > 0) {
        hexMap.loadIconImages(markerTypesConfig)
      }
      hexMap.onHexClick = (hex: any, _x: number, _y: number, type: string) => {
        if (drawMode.value) return // Don't select hexes when drawing
        if (type === 'click' && hex) {
          selectedHex.value = hex
          emit('hex-click', hex)
        }
      }
      hexMap.onCameraChange = () => {
        if (hexMap) currentZoom.value = hexMap.camera.zoom
        redraw()
      }
      if (props.initialHex) {
        selectedHex.value = props.initialHex
        hexMap.focusOnHex(props.initialHex.x, props.initialHex.y)
        emit('hex-click', props.initialHex)
      } else {
        hexMap.fitToView()
      }
      redraw()
      stopWatch()
    }
  }, { immediate: true })

  window.addEventListener('keydown', onDrawKeyDown)
})

watch([hexData, selectedHex, hexMarkers, mapPaths], () => {
  redraw()
})

// Reload icons when type config changes (e.g. Firestore data arrives with Storage URLs)
watch([locationTypes, featureTypes, pinTypes], () => {
  if (!hexMap) return
  const markerTypesConfig = {
    locationTypes: Object.fromEntries(locationTypes.value.map(t => [t.key, { iconUrl: t.iconUrl }])),
    featureTypes: Object.fromEntries(featureTypes.value.map(t => [t.key, { iconUrl: t.iconUrl }])),
    hexMarkerTypes: Object.fromEntries(pinTypes.value.map(t => [t.key, { iconUrl: t.iconUrl }]))
  }
  hexMap.loadIconImages(markerTypesConfig)
})

function focusOnHex(x: number, y: number) {
  if (hexMap) {
    selectedHex.value = { x, y }
    hexMap.focusOnHex(x, y)
    redraw()
  }
}

function clearSelection() {
  selectedHex.value = null
  if (hexMap) {
    hexMap.fitToView()
    redraw()
  }
}

async function refreshMarkers() {
  // With real-time listeners, markers auto-refresh. Force a redraw.
  recomputeHexMarkers()
  redraw()
}

defineExpose({ focusOnHex, clearSelection, refreshMarkers })

onUnmounted(() => {
  if (hexMap) {
    hexMap.destroy()
    hexMap = null
  }
  window.removeEventListener('keydown', onDrawKeyDown)
  unsubs.forEach(fn => fn())
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full min-h-[500px] relative bg-zinc-950 rounded-lg overflow-hidden">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <span class="text-[#ef233c] animate-pulse">Loading map...</span>
    </div>
    <canvas
      ref="canvasRef"
      class="block w-full h-full"
      :class="drawMode ? (draggingWaypoint ? 'cursor-grabbing' : (selectedPathId && !drawingPoints.length ? 'cursor-pointer' : 'cursor-crosshair')) : ''"
      @click="drawMode ? onDrawClick($event) : undefined"
      @dblclick="drawMode ? onDrawDblClick($event) : undefined"
      @mousedown="drawMode ? onDrawMouseDown($event) : undefined"
      @mousemove="drawMode ? onDrawMouseMoveGlobal($event) : undefined"
      @mouseup="drawMode ? onDrawMouseUp($event) : undefined"
      @contextmenu="onDrawContextMenu"
    />

    <!-- Draw mode toolbar (admin/DM only) -->
    <div v-if="canDraw && !drawMode" class="absolute top-3 right-3 z-20">
      <button
        @click="enterDrawMode"
        class="bg-black/60 backdrop-blur-sm text-zinc-300 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 transition-colors flex items-center gap-1.5"
        title="Draw roads & rivers"
      >
        ✏️ Draw
      </button>
    </div>

    <!-- Draw mode panel -->
    <div v-if="drawMode" class="absolute top-3 right-3 z-20 bg-black/85 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-3 min-w-[240px]">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-zinc-200" style="font-family: Manrope, sans-serif">✏️ Draw Mode</span>
        <button @click="exitDrawMode" class="text-zinc-400 hover:text-white text-sm px-1.5 py-0.5 rounded transition-colors hover:bg-white/10">✕</button>
      </div>

      <!-- Path type selector -->
      <div class="grid grid-cols-5 gap-1.5">
        <button
          v-for="opt in pathTypeOptions" :key="opt.value"
          @click="drawPathType = opt.value"
          :class="['py-2.5 px-1 rounded-lg border transition-all', drawPathType === opt.value ? 'border-[#ef233c]/50 bg-[#ef233c]/15 text-white' : 'border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-white/5']"
        >
          <span class="block text-center text-base leading-none">{{ opt.icon }}</span>
          <span class="block text-center text-[0.6rem] mt-1 leading-none">{{ opt.label }}</span>
        </button>
      </div>

      <!-- Instructions -->
      <div class="text-xs text-zinc-500 space-y-0.5 leading-relaxed">
        <p>Click to place waypoints</p>
        <p>Double-click / Enter / Right-click to finish</p>
        <p>Esc to cancel · Ctrl+Z to undo</p>
        <p>Click a path to select · Drag waypoints to edit</p>
        <p v-if="drawingPoints.length > 0" class="text-[#ef233c] font-medium">{{ drawingPoints.length }} point{{ drawingPoints.length === 1 ? '' : 's' }} placed</p>
      </div>

      <!-- Selected path actions -->
      <div v-if="selectedPathId" class="border-t border-white/10 pt-2 space-y-1">
        <p class="text-xs text-zinc-300 font-medium">Path selected</p>
        <p class="text-[0.65rem] text-zinc-500">Drag waypoints to reposition</p>
        <button @click="deletePath(selectedPathId!)" class="text-sm text-red-400 hover:text-red-300 transition-colors">🗑 Delete path</button>
      </div>

      <!-- Path count -->
      <div class="text-xs text-zinc-600">
        {{ mapPaths.length }} path{{ mapPaths.length === 1 ? '' : 's' }} on map
      </div>
    </div>

    <!-- Zoom indicator -->
    <div class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-zinc-400 text-xs font-mono px-2 py-1 rounded-lg border border-white/[0.06] pointer-events-none select-none">
      {{ currentZoom.toFixed(2) }}×
    </div>
  </div>
</template>

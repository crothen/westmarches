<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { collection, getDocs, getDocsFromServer, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { HexMap } from '../../lib/hexMap'
import type { HexMarkerData } from '../../lib/hexMap'
import { MAP_CONFIG } from '../../lib/mapData'
import { useMapData } from '../../composables/useMapData'
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
const auth = useAuthStore()
let hexMap: HexMap | null = null

const selectedHex = ref<{ x: number; y: number } | null>(null)
const hexMarkers = ref<Record<string, HexMarkerData>>({})

async function loadHexMarkers(fromServer = false) {
  try {
    const fetchFn = fromServer ? getDocsFromServer : getDocs
    // Use allSettled so one failing query doesn't break the rest
    const results = await Promise.allSettled([
      fetchFn(query(collection(db, 'locations'))),
      fetchFn(query(collection(db, 'features'))),
      fetchFn(query(collection(db, 'hexNotes'))),
      fetchFn(query(collection(db, 'markers')))
    ])

    const locSnap = results[0].status === 'fulfilled' ? results[0].value : null
    const featSnap = results[1].status === 'fulfilled' ? results[1].value : null
    const noteSnap = results[2].status === 'fulfilled' ? results[2].value : null
    const markerSnap = results[3].status === 'fulfilled' ? results[3].value : null

    // Log individual failures
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const names = ['locations', 'features', 'hexNotes', 'markers']
        console.warn(`Failed to load ${names[i]}:`, r.reason)
      }
    })

    const markers: Record<string, HexMarkerData> = {}

    // Track per-hex location counts to determine hidden state correctly
    const hexLocationCounts: Record<string, { total: number; hidden: number }> = {}
    locSnap?.docs.forEach(d => {
      const data = d.data()
      if (data.hexKey) {
        if (!markers[data.hexKey]) markers[data.hexKey] = { featureCount: 0, noteCount: 0 }
        if (!hexLocationCounts[data.hexKey]) hexLocationCounts[data.hexKey] = { total: 0, hidden: 0 }
        hexLocationCounts[data.hexKey]!.total++
        if (data.hidden) {
          hexLocationCounts[data.hexKey]!.hidden++
          markers[data.hexKey]!.hasHiddenItems = true
        } else {
          // Prefer the first visible location's type for the icon
          if (!markers[data.hexKey]!.locationType || markers[data.hexKey]!.hidden) {
            markers[data.hexKey]!.locationType = data.type || 'other'
          }
        }
        // Fallback: if no visible location set the type yet, use this one
        if (!markers[data.hexKey]!.locationType) {
          markers[data.hexKey]!.locationType = data.type || 'other'
        }
      }
    })
    // Only mark hex as hidden if ALL locations are hidden
    for (const [hexKey, counts] of Object.entries(hexLocationCounts)) {
      if (counts.total > 0 && counts.total === counts.hidden) {
        markers[hexKey]!.hidden = true
      }
    }

    featSnap?.docs.forEach(d => {
      const data = d.data()
      if (data.hexKey) {
        if (!markers[data.hexKey]) markers[data.hexKey] = { featureCount: 0, noteCount: 0 }
        markers[data.hexKey]!.featureCount++
        if (data.hidden) {
          markers[data.hexKey]!.hasHiddenItems = true
        }
      }
    })

    noteSnap?.docs.forEach(d => {
      const data = d.data()
      if (data.hexKey) {
        if (!markers[data.hexKey]) markers[data.hexKey] = { featureCount: 0, noteCount: 0 }
        markers[data.hexKey]!.noteCount++
      }
    })

    // Hex markers (clue, battle, etc.) — respect privacy
    const currentUid = auth.firebaseUser?.uid
    const isAdmin = auth.isAdmin
    markerSnap?.docs.forEach(d => {
      const data = d.data()
      if (data.hexKey) {
        // Skip private markers not visible to current user
        if (data.isPrivate) {
          if (data.createdBy !== currentUid && !isAdmin) return
        }
        if (!markers[data.hexKey]) markers[data.hexKey] = { featureCount: 0, noteCount: 0 }
        const m = markers[data.hexKey]!
        m.markerCount = (m.markerCount || 0) + 1
        if (!m.markerTypes) m.markerTypes = []
        if (data.type && !m.markerTypes.includes(data.type)) {
          m.markerTypes.push(data.type)
        }
        if (data.hidden) {
          m.hasHiddenItems = true
        }
      }
    })

    hexMarkers.value = markers
  } catch (e) {
    console.warn('Failed to load hex markers:', e)
  }
}

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  // Load marker data
  loadHexMarkers()

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
        hexMap?.draw(hexData.value, selectedHex.value, false, auth.role, hexMarkers.value)
      }
      // If there's an initial hex from the URL, focus on it; otherwise fit to view
      if (props.initialHex) {
        selectedHex.value = props.initialHex
        hexMap.focusOnHex(props.initialHex.x, props.initialHex.y)
        emit('hex-click', props.initialHex)
      } else {
        hexMap.fitToView()
      }
      hexMap.draw(hexData.value, selectedHex.value, false, auth.role, hexMarkers.value)
      stopWatch()
    }
  }, { immediate: true })
})

watch([hexData, selectedHex, hexMarkers], () => {
  if (hexMap) {
    hexMap.draw(hexData.value, selectedHex.value, false, auth.role, hexMarkers.value)
  }
})

function focusOnHex(x: number, y: number) {
  if (hexMap) {
    selectedHex.value = { x, y }
    hexMap.focusOnHex(x, y)
    hexMap.draw(hexData.value, selectedHex.value, false, auth.role, hexMarkers.value)
  }
}

function clearSelection() {
  selectedHex.value = null
  if (hexMap) {
    hexMap.fitToView()
    hexMap.draw(hexData.value, selectedHex.value, false, auth.role, hexMarkers.value)
  }
}

async function refreshMarkers() {
  await loadHexMarkers(true)
  // Force redraw in case watcher doesn't trigger
  if (hexMap) {
    hexMap.draw(hexData.value, selectedHex.value, false, auth.role, hexMarkers.value)
  }
}

defineExpose({ focusOnHex, clearSelection, refreshMarkers })

onUnmounted(() => {
  if (hexMap) {
    hexMap.destroy()
    hexMap = null
  }
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full min-h-[500px] relative bg-zinc-950 rounded-lg overflow-hidden">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <span class="text-[#ef233c] animate-pulse">Loading map...</span>
    </div>
    <canvas ref="canvasRef" class="block w-full h-full" />
  </div>
</template>

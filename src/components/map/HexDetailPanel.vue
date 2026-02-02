<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { collection, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuthStore } from '../../stores/auth'
import DetailMapViewer from './DetailMapViewer.vue'
import MentionTextarea from '../common/MentionTextarea.vue'
import NotesSection from '../common/NotesSection.vue'
import { useTypeConfig } from '../../composables/useTypeConfig'
import TypeSelect from '../common/TypeSelect.vue'
import type { HexMarker } from '../../types'

const props = defineProps<{
  hex: { x: number; y: number } | null
  terrainConfig: Record<string, any>
  tagsConfig: Record<string, any>
  hexData: Record<string, any>
}>()

const emit = defineEmits<{
  close: []
  'update-terrain': [hexKey: string, terrainId: number]
  'toggle-tag': [hexKey: string, tagId: number]
  'set-main-tag': [hexKey: string, tagId: number | null, isPrivate: boolean]
  'update-detail-map': [hexKey: string, url: string | null]
  'markers-changed': []
}>()

const auth = useAuthStore()
const showDetailMapViewer = ref(false)
const hexLocations = ref<any[]>([])
const hexFeatures = ref<any[]>([])
const allLocations = ref<any[]>([])
const allFeatures = ref<any[]>([])
const hexMarkersList = ref<HexMarker[]>([])

// Unified "Add Marker" modal state
const showMarkerModal = ref(false)
const markerModalTab = ref<'existing' | 'new'>('existing')
const poiSearch = ref('')
const poiLocationFilter = ref<string | ''>('')
const newMarkerKind = ref<'location' | 'feature' | 'pin'>('location')
const newMarkerForm = ref({ name: '', type: 'other', description: '', isPrivate: false })

const { locationTypes: locationTypeOptions, featureTypes: featureTypeOptions, pinTypes: pinTypeOptions, getIconUrl } = useTypeConfig()

const hexKey = computed(() => props.hex ? `${props.hex.x}_${props.hex.y}` : null)

const currentHexData = computed(() => {
  if (!hexKey.value) return null
  return props.hexData[hexKey.value] || {}
})

const terrainName = computed(() => {
  if (!currentHexData.value?.type) return 'Unknown'
  const id = currentHexData.value.type
  for (const [name, conf] of Object.entries(props.terrainConfig)) {
    if ((conf as any).id === id) return name
  }
  return `Terrain ${id}`
})

const terrainOptions = computed(() => {
  return Object.entries(props.terrainConfig)
    .map(([name, conf]) => ({ name, id: (conf as any).id }))
    .sort((a, b) => a.id - b.id)
})


const currentMainTag = computed(() => {
  const tagId = currentHexData.value?.mainTag
  if (!tagId) return null
  for (const [name, conf] of Object.entries(props.tagsConfig)) {
    if ((conf as any).id === tagId) return name
  }
  return null
})

const currentSideTags = computed(() => {
  const tags = currentHexData.value?.tags || []
  return tags.map((tagId: number) => {
    for (const [name, conf] of Object.entries(props.tagsConfig)) {
      if ((conf as any).id === tagId) return name
    }
    return `Tag ${tagId}`
  })
})

const _hexUnsubs: (() => void)[] = []

watch(hexKey, (newKey) => {
  // Unsubscribe from previous hex listeners
  _hexUnsubs.forEach(fn => fn())
  _hexUnsubs.length = 0

  hexLocations.value = []
  hexFeatures.value = []
  hexMarkersList.value = []
  if (!newKey) return

  _hexUnsubs.push(onSnapshot(query(collection(db, 'locations'), where('hexKey', '==', newKey)), (snap) => {
    hexLocations.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }, (e) => console.warn('Failed to load hex locations:', e)))

  _hexUnsubs.push(onSnapshot(query(collection(db, 'features'), where('hexKey', '==', newKey)), (snap) => {
    hexFeatures.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }, (e) => console.warn('Failed to load hex features:', e)))

  _hexUnsubs.push(onSnapshot(query(collection(db, 'markers'), where('hexKey', '==', newKey)), (snap) => {
    hexMarkersList.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as HexMarker))
  }, (e) => console.warn('Failed to load hex markers:', e)))
}, { immediate: true })

// Filtered visible locations/features (hide hidden items from players)
const visibleHexLocations = computed(() => {
  if (auth.isDm || auth.isAdmin) return hexLocations.value
  return hexLocations.value.filter((l: any) => !l.hidden)
})

const visibleHexFeatures = computed(() => {
  if (auth.isDm || auth.isAdmin) return hexFeatures.value
  return hexFeatures.value.filter((f: any) => !f.hidden)
})

const visibleHexMarkers = computed(() => {
  return hexMarkersList.value.filter(m => {
    // Admins see everything
    if (auth.isAdmin) return true
    // Hidden markers only visible to DM/admin
    if (m.hidden && !auth.isDm) return false
    // Private markers only visible to creator and admins (NOT DMs)
    if (m.isPrivate) {
      return m.createdBy === auth.firebaseUser?.uid
    }
    return true
  })
})

// Unified sorted list of all items in this hex
const sortedHexItems = computed(() => {
  const items: any[] = []
  for (const loc of visibleHexLocations.value) {
    items.push({ ...loc, _kind: 'location' as const })
  }
  for (const feat of visibleHexFeatures.value) {
    items.push({ ...feat, _kind: 'feature' as const })
  }
  for (const marker of visibleHexMarkers.value) {
    items.push({ ...marker, _kind: 'marker' as const })
  }
  return items.sort((a, b) => (a.mapOrder ?? 999) - (b.mapOrder ?? 999))
})

async function moveItem(item: any, currentIdx: number, direction: -1 | 1) {
  const targetIdx = currentIdx + direction
  if (targetIdx < 0 || targetIdx >= sortedHexItems.value.length) return
  const other = sortedHexItems.value[targetIdx]
  if (!other) return

  // Swap mapOrder values
  const itemOrder = item.mapOrder ?? currentIdx
  const otherOrder = other.mapOrder ?? targetIdx
  const newItemOrder = otherOrder
  const newOtherOrder = itemOrder

  // Determine collections
  const getCollName = (kind: string) => kind === 'location' ? 'locations' : kind === 'feature' ? 'features' : 'markers'

  try {
    await Promise.all([
      updateDoc(doc(db, getCollName(item._kind), item.id), { mapOrder: newItemOrder }),
      updateDoc(doc(db, getCollName(other._kind), other.id), { mapOrder: newOtherOrder })
    ])
    // Update local state
    const updateLocal = (list: any[], id: string, order: number) => {
      const idx = list.findIndex((i: any) => i.id === id)
      if (idx >= 0) list[idx] = { ...list[idx], mapOrder: order }
    }
    if (item._kind === 'location') updateLocal(hexLocations.value, item.id, newItemOrder)
    else if (item._kind === 'feature') updateLocal(hexFeatures.value, item.id, newItemOrder)
    else updateLocal(hexMarkersList.value, item.id, newItemOrder)

    if (other._kind === 'location') updateLocal(hexLocations.value, other.id, newOtherOrder)
    else if (other._kind === 'feature') updateLocal(hexFeatures.value, other.id, newOtherOrder)
    else updateLocal(hexMarkersList.value, other.id, newOtherOrder)

    emit('markers-changed')
  } catch (e) {
    console.error('Failed to reorder:', e)
  }
}

function openMarkerModal() {
  showMarkerModal.value = true
  markerModalTab.value = 'existing'
  poiSearch.value = ''
  poiLocationFilter.value = ''
  newMarkerKind.value = 'location'
  newMarkerForm.value = { name: '', type: 'other', description: '', isPrivate: false }
  loadAllPois()
}

async function createNewMarker() {
  if (!newMarkerForm.value.name.trim() || !hexKey.value) return
  try {
    if (newMarkerKind.value === 'pin') {
      const data = {
        name: newMarkerForm.value.name.trim(),
        type: newMarkerForm.value.type || 'clue',
        description: newMarkerForm.value.description.trim(),
        hexKey: hexKey.value,
        isPrivate: newMarkerForm.value.isPrivate,
        tags: [],
        createdBy: auth.firebaseUser?.uid || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }
      const docRef = await addDoc(collection(db, 'markers'), data)
      hexMarkersList.value.push({ id: docRef.id, ...data } as unknown as HexMarker)
    } else {
      const data = {
        name: newMarkerForm.value.name.trim(),
        type: newMarkerForm.value.type,
        description: newMarkerForm.value.description.trim(),
        hexKey: hexKey.value,
        tags: [],
        discoveredBy: auth.firebaseUser?.uid || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }
      const collName = newMarkerKind.value === 'location' ? 'locations' : 'features'
      const docRef = await addDoc(collection(db, collName), data)
      if (newMarkerKind.value === 'location') {
        hexLocations.value.push({ id: docRef.id, ...data })
      } else {
        hexFeatures.value.push({ id: docRef.id, ...data })
      }
    }
    showMarkerModal.value = false
    emit('markers-changed')
  } catch (e) {
    console.error('Failed to create marker:', e)
    alert('Failed to create marker.')
  }
}

async function deleteHexMarker(marker: HexMarker) {
  if (!confirm(`Delete marker "${marker.name}"?`)) return
  try {
    await deleteDoc(doc(db, 'markers', marker.id))
    hexMarkersList.value = hexMarkersList.value.filter(m => m.id !== marker.id)
    emit('markers-changed')
  } catch (e) {
    console.error('Failed to delete marker:', e)
  }
}

async function toggleMarkerHidden(marker: HexMarker) {
  const newHidden = !marker.hidden
  try {
    await updateDoc(doc(db, 'markers', marker.id), { hidden: newHidden, updatedAt: Timestamp.now() })
    const idx = hexMarkersList.value.findIndex(m => m.id === marker.id)
    if (idx >= 0) hexMarkersList.value[idx] = { ...hexMarkersList.value[idx]!, hidden: newHidden } as HexMarker
  } catch (e) {
    console.error('Failed to toggle marker hidden:', e)
  }
}

async function togglePoiHidden(poi: any, kind: 'location' | 'feature') {
  const collName = kind === 'location' ? 'locations' : 'features'
  const newHidden = !poi.hidden
  try {
    await updateDoc(doc(db, collName, poi.id), { hidden: newHidden, updatedAt: Timestamp.now() })
    const list = kind === 'location' ? hexLocations : hexFeatures
    const idx = list.value.findIndex((item: any) => item.id === poi.id)
    if (idx >= 0) {
      list.value[idx] = { ...list.value[idx], hidden: newHidden }
    }
  } catch (e) {
    console.error('Failed to toggle hidden:', e)
    alert('Failed to update.')
  }
}

onUnmounted(() => {
  _hexUnsubs.forEach(fn => fn())
  _poiUnsubs.forEach(fn => fn())
})

function onTerrainChange(e: Event) {
  const terrainId = parseInt((e.target as HTMLSelectElement).value)
  if (hexKey.value && !isNaN(terrainId)) {
    emit('update-terrain', hexKey.value, terrainId)
  }
}

const detailMapUrl = computed(() => currentHexData.value?.detailMapUrl || null)

const _poiUnsubs: (() => void)[] = []

function loadAllPois() {
  if (_poiUnsubs.length > 0) return // already subscribed

  _poiUnsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name', 'asc')), (snap) => {
    allLocations.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }, (e) => console.warn('Failed to load all locations:', e)))

  _poiUnsubs.push(onSnapshot(query(collection(db, 'features'), orderBy('name', 'asc')), (snap) => {
    allFeatures.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }, (e) => console.warn('Failed to load all features:', e)))
}


function poiLocationOptions() {
  // Unique locations that have features (for the filter dropdown)
  const locMap = new Map<string, string>()
  for (const f of allFeatures.value) {
    if (f.locationId) {
      const loc = allLocations.value.find((l: any) => l.id === f.locationId)
      if (loc) locMap.set(loc.id, loc.name)
    }
  }
  return Array.from(locMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

function filteredPois() {
  const q = poiSearch.value.toLowerCase()
  const locFilter = poiLocationFilter.value
  const currentLocIds = new Set(hexLocations.value.map((l: any) => l.id))
  const currentFeatIds = new Set(hexFeatures.value.map((f: any) => f.id))
  
  let locs = allLocations.value
    .filter(l => !currentLocIds.has(l.id))
    .filter(l => !q || l.name?.toLowerCase().includes(q))
  
  let feats = allFeatures.value
    .filter(f => !currentFeatIds.has(f.id))
    .filter(f => !q || f.name?.toLowerCase().includes(q))
  
  // Apply location filter
  if (locFilter) {
    locs = locs.filter(l => l.id === locFilter)
    feats = feats.filter(f => f.locationId === locFilter)
  }
  
  return [
    ...locs.map(l => ({ ...l, _kind: 'location' as const, _currentHex: l.hexKey || null })),
    ...feats.map(f => ({ ...f, _kind: 'feature' as const, _currentHex: f.hexKey || null }))
  ]
}

async function assignPoiToHex(poi: any) {
  if (!hexKey.value) return
  const collName = poi._kind === 'location' ? 'locations' : 'features'
  try {
    await updateDoc(doc(db, collName, poi.id), { hexKey: hexKey.value })
    // Update local state
    if (poi._kind === 'location') {
      hexLocations.value.push({ ...poi })
    } else {
      hexFeatures.value.push({ ...poi })
    }
    emit('markers-changed')
  } catch (e) {
    console.error('Failed to assign POI:', e)
    alert('Failed to assign POI.')
  }
}

async function unassignPoi(poi: any, kind: 'location' | 'feature') {
  const collName = kind === 'location' ? 'locations' : 'features'
  try {
    await updateDoc(doc(db, collName, poi.id), { hexKey: null })
    if (kind === 'location') {
      hexLocations.value = hexLocations.value.filter((l: any) => l.id !== poi.id)
    } else {
      hexFeatures.value = hexFeatures.value.filter((f: any) => f.id !== poi.id)
    }
    emit('markers-changed')
  } catch (e) {
    console.error('Failed to unassign POI:', e)
  }
}


</script>

<template>
  <div v-if="hex" class="w-80 lg:w-96 min-h-[calc(100vh-5rem)] border-l border-white/[0.06] bg-black/80 backdrop-blur-xl overflow-y-auto">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/[0.06] p-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-zinc-100" style="font-family: Manrope, sans-serif">Hex {{ hex.x }}, {{ hex.y }}</h3>
        <p class="text-sm text-zinc-600">{{ terrainName }}</p>
      </div>
      <button @click="emit('close')" class="text-zinc-600 hover:text-zinc-300 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <div class="p-4 space-y-5">
      <!-- Tags info (visible to all) -->
      <div v-if="currentMainTag || currentSideTags.length > 0">
        <h4 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Tags</h4>
        <div class="flex flex-wrap gap-1.5">
          <span v-if="currentMainTag" class="text-sm bg-[#ef233c]/15 text-[#ef233c] px-2.5 py-1 rounded-full">{{ currentMainTag }}</span>
          <span v-for="tag in currentSideTags" :key="tag" class="text-sm bg-white/5 text-zinc-500 px-2.5 py-1 rounded-full">{{ tag }}</span>
        </div>
      </div>

      <!-- Markers in this hex (unified sorted list) -->
      <div v-if="sortedHexItems.length > 0 || auth.isAuthenticated">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Markers</h4>
          <button v-if="auth.isAuthenticated && !auth.isGuest" @click="openMarkerModal" class="text-sm font-medium text-white hover:text-[#ef233c] transition-colors">+ Marker</button>
        </div>
        <div class="space-y-1.5">
          <div
            v-for="(item, idx) in sortedHexItems" :key="item.id"
            :class="['card-flat p-2.5 hover:border-white/20 transition-colors flex items-center justify-between',
              item.hidden ? 'opacity-50 !border-dashed' : '',
              item._kind === 'marker' && item.isPrivate ? 'border-dashed !border-purple-500/30' : '']"
          >
            <div class="flex items-center gap-2.5 flex-1 min-w-0">
              <!-- Order arrows (DM/admin only) -->
              <div v-if="auth.isDm || auth.isAdmin" class="flex flex-col shrink-0 -my-1">
                <button @click="moveItem(item, idx, -1)" :disabled="idx === 0" :class="['text-xs leading-none transition-colors', idx === 0 ? 'text-zinc-800' : 'text-zinc-600 hover:text-zinc-300']">▲</button>
                <button @click="moveItem(item, idx, 1)" :disabled="idx === sortedHexItems.length - 1" :class="['text-xs leading-none transition-colors', idx === sortedHexItems.length - 1 ? 'text-zinc-800' : 'text-zinc-600 hover:text-zinc-300']">▼</button>
              </div>
              <img :src="getIconUrl(item.type || 'other')" class="w-6 h-6 object-contain shrink-0" />
              <span :class="['text-sm truncate', item._kind === 'location' ? 'text-zinc-200 font-medium' : 'text-zinc-300']">{{ item.name }}</span>
              <span v-if="item._kind === 'marker' && item.isPrivate" class="text-xs bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded-full shrink-0">🔒</span>
              <span v-if="item.hidden && (auth.isDm || auth.isAdmin)" class="text-xs text-amber-400/70 shrink-0">🚫</span>
              <span class="text-xs text-zinc-600 shrink-0">{{ item.type }}</span>
            </div>
            <div class="flex items-center gap-1.5 ml-2 shrink-0">
              <RouterLink v-if="item._kind === 'location'" :to="`/locations/${item.id}`" class="text-zinc-600 hover:text-[#ef233c] text-base transition-colors" title="View detail">🔍</RouterLink>
              <RouterLink v-if="item._kind === 'feature' && item.locationId" :to="`/locations/${item.locationId}`" class="text-zinc-600 hover:text-[#ef233c] text-base transition-colors" title="View parent location">🔍</RouterLink>
              <button v-if="(auth.isDm || auth.isAdmin) && item._kind !== 'marker'" @click="togglePoiHidden(item, item._kind)" :class="['text-base transition-colors', item.hidden ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-700 hover:text-amber-400']" :title="item.hidden ? 'Show' : 'Hide'">{{ item.hidden ? '🚫' : '👁️' }}</button>
              <button v-if="(auth.isDm || auth.isAdmin) && item._kind === 'marker'" @click="toggleMarkerHidden(item)" :class="['text-base transition-colors', item.hidden ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-700 hover:text-amber-400']" :title="item.hidden ? 'Show' : 'Hide'">{{ item.hidden ? '🚫' : '👁️' }}</button>
              <button v-if="(auth.isDm || auth.isAdmin) && item._kind !== 'marker'" @click="unassignPoi(item, item._kind)" class="text-zinc-700 hover:text-red-400 text-base transition-colors" title="Remove from hex">✕</button>
              <button v-if="item._kind === 'marker' && (auth.isDm || auth.isAdmin || item.createdBy === auth.firebaseUser?.uid)" @click="deleteHexMarker(item)" class="text-zinc-700 hover:text-red-400 text-base transition-colors" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <!-- DM/Admin Edit Section -->
      <div v-if="auth.isDm || auth.isAdmin" class="card-flat !rounded-lg p-3 space-y-3">
        <h4 class="text-sm font-semibold text-[#ef233c] uppercase tracking-wider">DM Tools</h4>
        
        <!-- Terrain picker -->
        <div>
          <label class="block text-sm text-zinc-600 mb-1">Terrain</label>
          <select :value="currentHexData?.type || 1" @change="onTerrainChange" class="input w-full text-sm">
            <option v-for="t in terrainOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
      </div>

      <!-- Detail Map Preview (visible to non-DMs/non-admins) -->
      <div v-if="detailMapUrl && !auth.isDm && !auth.isAdmin">
        <h4 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Detail Map</h4>
        <img :src="detailMapUrl" class="w-full max-h-48 object-contain rounded-lg border border-white/10 cursor-pointer hover:border-white/20 transition-colors" @click="showDetailMapViewer = true" />
      </div>

      <!-- Notes Section -->
      <NotesSection
        v-if="hexKey"
        collection-name="hexNotes"
        parent-id-field="hexKey"
        :parent-id-value="hexKey"
        order-direction="desc"
        title="Notes"
        variant="compact"
        @notes-changed="emit('markers-changed')"
      />
    </div>

    <!-- Detail Map Viewer Modal -->
    <DetailMapViewer
      v-if="showDetailMapViewer && detailMapUrl"
      :image-url="detailMapUrl"
      :hex-label="`Hex ${hex.x}, ${hex.y}`"
      @close="showDetailMapViewer = false"
    />

    <!-- Unified Add Marker Modal -->
    <Teleport to="body">
      <transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showMarkerModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showMarkerModal = false" />
          <div class="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden">
            <!-- Modal header -->
            <div class="flex items-center justify-between p-4 pb-3 border-b border-white/[0.06]">
              <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">📌 Add Marker — Hex {{ hex?.x }}, {{ hex?.y }}</h3>
              <button @click="showMarkerModal = false" class="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>

            <!-- Tabs: Existing / New -->
            <div class="flex border-b border-white/[0.06]">
              <button @click="markerModalTab = 'existing'" :class="['flex-1 text-xs py-2.5 transition-colors', markerModalTab === 'existing' ? 'text-[#ef233c] border-b-2 border-[#ef233c]' : 'text-zinc-500 hover:text-zinc-300']">Existing</button>
              <button @click="markerModalTab = 'new'" :class="['flex-1 text-xs py-2.5 transition-colors', markerModalTab === 'new' ? 'text-[#ef233c] border-b-2 border-[#ef233c]' : 'text-zinc-500 hover:text-zinc-300']">New</button>
            </div>

            <div class="p-4 space-y-3">
              <!-- EXISTING TAB -->
              <template v-if="markerModalTab === 'existing'">
                <input v-model="poiSearch" type="text" placeholder="Search locations & features..." class="input w-full text-sm" />
                <select v-model="poiLocationFilter" class="input w-full text-sm">
                  <option value="">All locations</option>
                  <option v-for="loc in poiLocationOptions()" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
                </select>
                <div class="max-h-64 overflow-y-auto space-y-1">
                  <div v-if="filteredPois().length === 0" class="text-zinc-600 text-xs py-4 text-center">No matches</div>
                  <button
                    v-for="poi in filteredPois().slice(0, 30)" :key="poi.id"
                    @click="assignPoiToHex(poi); showMarkerModal = false"
                    class="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <img :src="getIconUrl(poi.type || 'other')" class="w-5 h-5 object-contain shrink-0" />
                    <span class="text-sm text-zinc-300 truncate flex-1">{{ poi.name }}</span>
                    <span class="text-[0.6rem] text-zinc-600 shrink-0">{{ poi.type }}</span>
                    <span v-if="poi._currentHex" class="text-[0.55rem] text-amber-500/60 shrink-0">@ {{ poi._currentHex }}</span>
                  </button>
                </div>
              </template>

              <!-- NEW TAB -->
              <template v-if="markerModalTab === 'new'">
                <!-- Kind selector -->
                <div class="flex gap-1">
                  <button @click="newMarkerKind = 'location'; newMarkerForm.type = 'other'" :class="['flex-1 text-xs py-1.5 rounded-lg transition-colors', newMarkerKind === 'location' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/5 text-zinc-500 hover:text-zinc-300']">Location</button>
                  <button @click="newMarkerKind = 'feature'; newMarkerForm.type = 'other'" :class="['flex-1 text-xs py-1.5 rounded-lg transition-colors', newMarkerKind === 'feature' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/5 text-zinc-500 hover:text-zinc-300']">Feature</button>
                  <button @click="newMarkerKind = 'pin'; newMarkerForm.type = 'clue'" :class="['flex-1 text-xs py-1.5 rounded-lg transition-colors', newMarkerKind === 'pin' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/5 text-zinc-500 hover:text-zinc-300']">Pin</button>
                </div>

                <input v-model="newMarkerForm.name" class="input w-full text-sm" placeholder="Name" @keyup.enter="createNewMarker" />
                <TypeSelect
                  v-model="newMarkerForm.type"
                  :options="newMarkerKind === 'location' ? locationTypeOptions : newMarkerKind === 'feature' ? featureTypeOptions : pinTypeOptions"
                  input-class="w-full text-sm"
                />
                <MentionTextarea v-model="newMarkerForm.description" input-class="text-sm" :rows="2" placeholder="Description (optional)" />

                <!-- Private checkbox (pins only) -->
                <label v-if="newMarkerKind === 'pin'" class="flex items-center gap-1.5 text-xs text-zinc-500">
                  <input v-model="newMarkerForm.isPrivate" type="checkbox" class="accent-purple-500" />
                  🔒 Private (only you & admins)
                </label>

                <button @click="createNewMarker" :disabled="!newMarkerForm.name.trim()" class="btn !text-xs !py-1.5 w-full">
                  Create {{ newMarkerKind === 'location' ? 'Location' : newMarkerKind === 'feature' ? 'Feature' : 'Pin' }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

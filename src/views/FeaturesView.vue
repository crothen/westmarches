<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { cleanupFeatureReferences } from '../lib/entityCleanup'
import HexMiniMap from '../components/map/HexMiniMap.vue'
import type { CampaignLocation, LocationFeature, HexMarker } from '../types'
import { useTypeConfig } from '../composables/useTypeConfig'
import TypeSelect from '../components/common/TypeSelect.vue'
import MentionTextarea from '../components/common/MentionTextarea.vue'

const auth = useAuthStore()
const locations = ref<CampaignLocation[]>([])
const features = ref<LocationFeature[]>([])
const markers = ref<HexMarker[]>([])
const loading = ref(true)
const searchQuery = ref('')

// Modal state
const showAddModal = ref(false)
const addTab = ref<'feature' | 'pin'>('feature')

const newFeat = ref({ name: '', type: 'other' as string, description: '', locationId: '', hexKey: '' })
const newPin = ref({ name: '', type: 'clue' as string, description: '', locationId: '', hexKey: '', isPrivate: false })

type VisibilityFilter = 'all' | 'visible' | 'hidden'
const visibilityFilter = ref<VisibilityFilter>('all')
const typeFilter = ref<string>('')
const locationFilter = ref<string>('')
type KindFilter = 'all' | 'feature' | 'pin'
const kindFilter = ref<KindFilter>('all')

// Edit state
type EditKind = 'feature' | 'pin'
const editKind = ref<EditKind>('feature')
const editingFeature = ref<LocationFeature | null>(null)
const editingPin = ref<HexMarker | null>(null)
const editForm = ref({ name: '', type: 'other' as string, description: '' })
const editPinForm = ref({ name: '', type: 'clue' as string, description: '', isPrivate: false })

const { featureTypes: featureTypeOptions, pinTypes: pinTypeOptions, getIconUrl } = useTypeConfig()

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name', 'asc')), (snap) => {
    locations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
  }, (e) => console.error('Failed to load locations:', e)))

  _unsubs.push(onSnapshot(query(collection(db, 'features'), orderBy('name', 'asc')), (snap) => {
    features.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
    loading.value = false
  }, (e) => {
    console.error('Failed to load features:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'markers'), orderBy('name', 'asc')), (snap) => {
    markers.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as HexMarker))
  }, (e) => console.error('Failed to load markers:', e)))
})

// Unified POI type
interface PoiFeature extends LocationFeature { _kind: 'feature' }
interface PoiPin extends HexMarker { _kind: 'pin' }
type Poi = PoiFeature | PoiPin

const allPois = computed<Poi[]>(() => {
  const uid = auth.firebaseUser?.uid
  const isPrivileged = auth.isDm || auth.isAdmin

  // Build feature list
  let feats: Poi[] = features.value.map(f => ({ ...f, _kind: 'feature' as const }))
  // Build marker list (visibility: private pins only visible to creator + admins)
  let pins: Poi[] = markers.value
    .filter(m => {
      if (m.isPrivate && !isPrivileged && m.createdBy !== uid) return false
      return true
    })
    .map(m => ({ ...m, _kind: 'pin' as const }))

  let result: Poi[] = [...feats, ...pins]

  // Kind filter
  if (kindFilter.value === 'feature') {
    result = result.filter(p => p._kind === 'feature')
  } else if (kindFilter.value === 'pin') {
    result = result.filter(p => p._kind === 'pin')
  }

  // Visibility filter (hidden)
  if (!isPrivileged) {
    result = result.filter(p => !p.hidden)
  } else if (visibilityFilter.value === 'visible') {
    result = result.filter(p => !p.hidden)
  } else if (visibilityFilter.value === 'hidden') {
    result = result.filter(p => p.hidden)
  }

  // Type filter
  if (typeFilter.value) {
    result = result.filter(p => p.type === typeFilter.value)
  }

  // Location filter
  if (locationFilter.value) {
    result = result.filter(p => p.locationId === locationFilter.value)
  }

  // Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
  }

  // Sort alphabetically
  result.sort((a, b) => a.name.localeCompare(b.name))
  return result
})

function getLocationName(locId: string): string {
  return locations.value.find(l => l.id === locId)?.name || 'Unknown'
}

function getPoiHexKey(poi: Poi): string | null {
  if (poi.hexKey) return poi.hexKey
  if (poi.locationId) {
    const loc = locations.value.find(l => l.id === poi.locationId)
    return loc?.hexKey || null
  }
  return null
}

// Mini map hover/tap state
const miniMapHex = ref<string | null>(null)
const miniMapPos = ref({ x: 0, y: 0 })

function showMiniMap(hexKey: string, event: MouseEvent | TouchEvent) {
  const el = event.target as HTMLElement
  const rect = el.getBoundingClientRect()
  miniMapPos.value = { x: rect.left, y: rect.bottom + 4 }
  miniMapHex.value = hexKey
}

function hideMiniMap() {
  miniMapHex.value = null
}

function toggleMiniMap(hexKey: string, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (miniMapHex.value === hexKey) {
    miniMapHex.value = null
  } else {
    showMiniMap(hexKey, event)
  }
}

function onGlobalClick() {
  if (miniMapHex.value) miniMapHex.value = null
}

onMounted(() => document.addEventListener('click', onGlobalClick))
onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick)
  _unsubs.forEach(fn => fn())
})

// --- Feature CRUD ---
async function addFeature() {
  if (!newFeat.value.name.trim()) return
  await addDoc(collection(db, 'features'), {
    name: newFeat.value.name.trim(),
    type: newFeat.value.type,
    description: newFeat.value.description.trim(),
    locationId: newFeat.value.locationId || null,
    hexKey: newFeat.value.hexKey.trim() || null,
    tags: [],
    discoveredBy: auth.firebaseUser?.uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  newFeat.value = { name: '', type: 'other', description: '', locationId: '', hexKey: '' }
  showAddModal.value = false
}

async function toggleHidden(poi: Poi) {
  const coll = poi._kind === 'feature' ? 'features' : 'markers'
  const newHidden = !poi.hidden
  try {
    await updateDoc(doc(db, coll, poi.id), { hidden: newHidden, updatedAt: Timestamp.now() })
  } catch (e) {
    console.error('Failed to toggle hidden:', e)
  }
}

function startEdit(poi: Poi) {
  if (poi._kind === 'feature') {
    editKind.value = 'feature'
    editingFeature.value = poi
    editingPin.value = null
    editForm.value = { name: poi.name, type: poi.type, description: poi.description || '' }
  } else {
    editKind.value = 'pin'
    editingPin.value = poi
    editingFeature.value = null
    editPinForm.value = { name: poi.name, type: poi.type, description: poi.description || '', isPrivate: poi.isPrivate || false }
  }
}

async function saveEdit() {
  if (!editingFeature.value || !editForm.value.name.trim()) return
  const id = editingFeature.value.id
  const updates = {
    name: editForm.value.name.trim(),
    type: editForm.value.type,
    description: editForm.value.description.trim(),
    updatedAt: Timestamp.now()
  }
  try {
    await updateDoc(doc(db, 'features', id), updates)
    editingFeature.value = null
  } catch (e) {
    console.error('Failed to save:', e)
    alert('Failed to save changes.')
  }
}

async function saveEditPin() {
  if (!editingPin.value || !editPinForm.value.name.trim()) return
  const id = editingPin.value.id
  const updates = {
    name: editPinForm.value.name.trim(),
    type: editPinForm.value.type,
    description: editPinForm.value.description.trim(),
    isPrivate: editPinForm.value.isPrivate,
    updatedAt: Timestamp.now()
  }
  try {
    await updateDoc(doc(db, 'markers', id), updates)
    editingPin.value = null
  } catch (e) {
    console.error('Failed to save pin:', e)
    alert('Failed to save changes.')
  }
}

async function deleteFeature(feat: LocationFeature) {
  if (!confirm(`Delete "${feat.name}"? This cannot be undone.`)) return
  try {
    await cleanupFeatureReferences(feat.id)
    await deleteDoc(doc(db, 'features', feat.id))
  } catch (e) {
    console.error('Failed to delete:', e)
    alert('Failed to delete feature.')
  }
}

// --- Pin CRUD ---
async function addPin() {
  if (!newPin.value.name.trim()) return
  await addDoc(collection(db, 'markers'), {
    name: newPin.value.name.trim(),
    type: newPin.value.type,
    description: newPin.value.description.trim(),
    locationId: newPin.value.locationId || null,
    hexKey: newPin.value.hexKey.trim() || null,
    isPrivate: newPin.value.isPrivate,
    tags: [],
    createdBy: auth.firebaseUser?.uid || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  newPin.value = { name: '', type: 'clue', description: '', locationId: '', hexKey: '', isPrivate: false }
  showAddModal.value = false
}

async function deletePin(marker: HexMarker) {
  if (!confirm(`Delete pin "${marker.name}"? This cannot be undone.`)) return
  try {
    await deleteDoc(doc(db, 'markers', marker.id))
  } catch (e) {
    console.error('Failed to delete pin:', e)
    alert('Failed to delete pin.')
  }
}

function deletePoi(poi: Poi) {
  if (poi._kind === 'feature') {
    deleteFeature(poi)
  } else {
    deletePin(poi)
  }
}

// Get the current type filter icon
const typeFilterIcon = computed(() => {
  if (!typeFilter.value) return ''
  const feat = featureTypeOptions.value.find(o => o.key === typeFilter.value)
  if (feat) return feat.iconUrl
  const pin = pinTypeOptions.value.find(o => o.key === typeFilter.value)
  return pin?.iconUrl || ''
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📌 Points of Interest</h1>
      <div class="flex items-center gap-3">
        <span class="text-zinc-600 text-sm">{{ allPois.length }} POIs</span>
        <button @click="showAddModal = true" class="btn !text-xs !py-1.5">+ Add POI</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card-flat p-3 mb-5 flex flex-wrap items-center gap-3">
      <input v-model="searchQuery" type="text" placeholder="Search..." class="input flex-1 min-w-[180px] max-w-sm !bg-white/[0.03]" />

      <!-- Kind filter -->
      <div class="flex rounded-lg overflow-hidden border border-white/[0.08]">
        <button
          v-for="opt in ([
            { key: 'all', label: 'All' },
            { key: 'feature', label: 'Features' },
            { key: 'pin', label: 'Pins' }
          ] as const)" :key="opt.key"
          @click="kindFilter = opt.key"
          :class="[
            'text-xs px-3 py-1.5 transition-all whitespace-nowrap',
            kindFilter === opt.key
              ? 'bg-white/10 text-zinc-200'
              : 'bg-white/[0.02] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.05]'
          ]"
        >{{ opt.label }}</button>
      </div>

      <!-- Type filter -->
      <div class="flex items-center gap-1.5">
        <img v-if="typeFilterIcon" :src="typeFilterIcon" class="w-4 h-4 object-contain" />
        <select v-model="typeFilter" class="input !w-auto !bg-white/[0.03] text-sm">
          <option value="">All types</option>
          <optgroup label="Features">
            <option v-for="t in featureTypeOptions" :key="t.key" :value="t.key">{{ t.label }}</option>
          </optgroup>
          <optgroup label="Pins">
            <option v-for="t in pinTypeOptions" :key="t.key" :value="t.key">{{ t.label }}</option>
          </optgroup>
        </select>
      </div>

      <!-- Location filter -->
      <select v-model="locationFilter" class="input !w-auto !bg-white/[0.03] text-sm max-w-[200px]">
        <option value="">All locations</option>
        <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
      </select>

      <!-- Visibility filter (DM/Admin only) -->
      <div v-if="auth.isDm || auth.isAdmin" class="flex rounded-lg overflow-hidden border border-white/[0.08]">
        <button
          v-for="opt in ([
            { key: 'all', label: 'All', icon: '🌐' },
            { key: 'visible', label: 'Visible', icon: '👁️' },
            { key: 'hidden', label: 'Hidden', icon: '🚫' }
          ] as const)" :key="opt.key"
          @click="visibilityFilter = opt.key"
          :class="[
            'text-xs px-3 py-1.5 transition-all whitespace-nowrap',
            visibilityFilter === opt.key
              ? opt.key === 'hidden' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-zinc-200'
              : 'bg-white/[0.02] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.05]'
          ]"
        >{{ opt.icon }} {{ opt.label }}</button>
      </div>

      <!-- Result count -->
      <span class="text-zinc-600 text-xs ml-auto">{{ allPois.length }} result{{ allPois.length !== 1 ? 's' : '' }}</span>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="allPois.length === 0" class="card p-10 text-center relative z-10">
      <div class="relative z-10 text-zinc-600">No points of interest discovered yet.</div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <div v-for="poi in allPois" :key="poi._kind + '-' + poi.id" :class="['card relative z-10', poi.hidden ? '!border-amber-500/40 !border-dashed !border-2' : '']">
        <div class="relative z-10">
          <!-- Hidden banner -->
          <div v-if="poi.hidden" class="absolute top-0 left-0 right-0 bg-amber-500/20 border-b-2 border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-widest text-center py-1.5 z-10 rounded-t-xl" style="font-family: Manrope, sans-serif">🚫 Hidden from players</div>
          <!-- Admin action buttons -->
          <div v-if="auth.isDm || auth.isAdmin" class="absolute top-2 right-2 flex gap-1 z-20" :class="poi.hidden ? 'top-9' : ''">
            <button @click.prevent="toggleHidden(poi)" :class="['text-zinc-600 hover:text-amber-400 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors', poi.hidden ? '!text-amber-400' : '']" :title="poi.hidden ? 'Show to players' : 'Hide from players'">{{ poi.hidden ? '🚫' : '👁️' }}</button>
            <button @click.prevent="startEdit(poi)" class="text-zinc-600 hover:text-zinc-300 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors" title="Edit">✏️</button>
            <button @click.prevent="deletePoi(poi)" class="text-zinc-600 hover:text-red-400 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors" title="Delete">🗑️</button>
          </div>

          <!-- Feature card (with RouterLink) -->
          <component :is="poi._kind === 'feature' ? 'RouterLink' : 'div'" :to="poi._kind === 'feature' ? `/features/${poi.id}` : undefined" :class="['block p-5 transition-colors rounded-xl', poi._kind === 'feature' ? 'hover:bg-white/[0.02]' : '']">
            <div :class="poi.hidden ? 'mt-5' : ''">
              <div class="flex items-center gap-2 min-w-0 mb-1 pr-24">
                <img :src="getIconUrl(poi.type)" class="w-6 h-6 object-contain" :alt="poi.type" />
                <h3 class="text-base font-semibold text-white truncate" style="font-family: Manrope, sans-serif">{{ poi.name }}</h3>
                <span v-if="poi._kind === 'pin' && (poi as PoiPin).isPrivate" title="Private pin">🔒</span>
              </div>
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class="badge bg-white/5 text-zinc-500">{{ poi.type }}</span>
                <span :class="['text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', poi._kind === 'feature' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-emerald-500/15 text-emerald-400']">{{ poi._kind === 'feature' ? 'Feature' : 'Pin' }}</span>
                <span v-if="poi.locationId" class="text-xs text-zinc-500" @click.prevent>
                  <RouterLink :to="`/locations/${poi.locationId}`" class="hover:text-[#ef233c] transition-colors">in {{ getLocationName(poi.locationId) }}</RouterLink>
                </span>
                <span v-if="getPoiHexKey(poi)" class="text-xs text-zinc-600 cursor-default" @click.prevent @mouseenter="showMiniMap(getPoiHexKey(poi)!, $event)" @mouseleave="hideMiniMap" @click.prevent.stop="toggleMiniMap(getPoiHexKey(poi)!, $event)">📍 Hex {{ getPoiHexKey(poi) }}</span>
              </div>
              <p class="text-sm text-zinc-500">{{ poi.description }}</p>
            </div>
          </component>
        </div>
      </div>
    </div>

    <!-- Add POI Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" @click.self="showAddModal = false">
          <div class="card p-5 w-full max-w-lg relative z-10">
            <div class="relative z-10 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-zinc-200 font-semibold" style="font-family: Manrope, sans-serif">Add Point of Interest</h3>
                <button @click="showAddModal = false" class="text-zinc-500 hover:text-white transition-colors">✕</button>
              </div>

              <!-- Tabs -->
              <div class="flex rounded-lg overflow-hidden border border-white/[0.08]">
                <button
                  @click="addTab = 'feature'"
                  :class="['flex-1 text-sm px-4 py-2 transition-all', addTab === 'feature' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]']"
                >Feature</button>
                <button
                  @click="addTab = 'pin'"
                  :class="['flex-1 text-sm px-4 py-2 transition-all', addTab === 'pin' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]']"
                >Pin</button>
              </div>

              <!-- Feature tab -->
              <div v-if="addTab === 'feature'" class="space-y-3">
                <input v-model="newFeat.name" placeholder="Name" class="input w-full" />
                <TypeSelect v-model="newFeat.type" :options="featureTypeOptions" input-class="w-full" />
                <select v-model="newFeat.locationId" class="input w-full">
                  <option value="">No parent location (standalone)</option>
                  <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
                </select>
                <input v-model="newFeat.hexKey" placeholder="Hex (e.g. 25_30) — for standalone" class="input w-full" />
                <MentionTextarea v-model="newFeat.description" placeholder="Description..." :rows="3" />
                <div class="flex justify-end gap-2">
                  <button @click="showAddModal = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                  <button @click="addFeature" :disabled="!newFeat.name.trim()" class="btn text-sm">Create Feature</button>
                </div>
              </div>

              <!-- Pin tab -->
              <div v-if="addTab === 'pin'" class="space-y-3">
                <input v-model="newPin.name" placeholder="Name" class="input w-full" />
                <TypeSelect v-model="newPin.type" :options="pinTypeOptions" input-class="w-full" />
                <select v-model="newPin.locationId" class="input w-full">
                  <option value="">No location</option>
                  <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
                </select>
                <input v-model="newPin.hexKey" placeholder="Hex (e.g. 25_30)" class="input w-full" />
                <MentionTextarea v-model="newPin.description" placeholder="Description..." :rows="3" />
                <label class="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <input type="checkbox" v-model="newPin.isPrivate" class="accent-emerald-500" />
                  Private (only you and admins can see)
                </label>
                <div class="flex justify-end gap-2">
                  <button @click="showAddModal = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                  <button @click="addPin" :disabled="!newPin.name.trim()" class="btn text-sm">Create Pin</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Edit Feature Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="editingFeature" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" @click.self="editingFeature = null">
          <div class="card p-5 w-full max-w-lg relative z-10 space-y-3">
            <div class="relative z-10 space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-zinc-200 font-semibold" style="font-family: Manrope, sans-serif">Edit Feature</h3>
                <button @click="editingFeature = null" class="text-zinc-500 hover:text-white transition-colors">✕</button>
              </div>
              <input v-model="editForm.name" placeholder="Name" class="input w-full" />
              <TypeSelect v-model="editForm.type" :options="featureTypeOptions" input-class="w-full" />
              <MentionTextarea v-model="editForm.description" placeholder="Description..." :rows="3" />
              <div class="flex justify-end gap-2">
                <button @click="editingFeature = null" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                <button @click="saveEdit" :disabled="!editForm.name.trim()" class="btn text-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Edit Pin Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="editingPin" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" @click.self="editingPin = null">
          <div class="card p-5 w-full max-w-lg relative z-10 space-y-3">
            <div class="relative z-10 space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-zinc-200 font-semibold" style="font-family: Manrope, sans-serif">Edit Pin</h3>
                <button @click="editingPin = null" class="text-zinc-500 hover:text-white transition-colors">✕</button>
              </div>
              <input v-model="editPinForm.name" placeholder="Name" class="input w-full" />
              <TypeSelect v-model="editPinForm.type" :options="pinTypeOptions" input-class="w-full" />
              <MentionTextarea v-model="editPinForm.description" placeholder="Description..." :rows="3" />
              <label class="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" v-model="editPinForm.isPrivate" class="accent-emerald-500" />
                Private (only you and admins can see)
              </label>
              <div class="flex justify-end gap-2">
                <button @click="editingPin = null" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                <button @click="saveEditPin" :disabled="!editPinForm.name.trim()" class="btn text-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Mini map hover popup -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-75"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="miniMapHex" class="fixed z-[100] shadow-2xl rounded-lg border border-white/10 bg-zinc-950/95 backdrop-blur-sm p-1 pointer-events-none" :style="{ left: miniMapPos.x + 'px', top: miniMapPos.y + 'px' }">
          <HexMiniMap :hexKey="miniMapHex" :width="280" />
        </div>
      </transition>
    </Teleport>
  </div>
</template>

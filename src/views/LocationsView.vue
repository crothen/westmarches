<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy, where, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import HexMiniMap from '../components/map/HexMiniMap.vue'
import TypeSelect from '../components/common/TypeSelect.vue'
import { useTypeConfig } from '../composables/useTypeConfig'
import type { CampaignLocation, LocationFeature } from '../types'

const auth = useAuthStore()
const locations = ref<CampaignLocation[]>([])
const features = ref<LocationFeature[]>([])
const loading = ref(true)
const searchQuery = ref('')
const showAddForm = ref(false)
type VisibilityFilter = 'all' | 'visible' | 'hidden'
const visibilityFilter = ref<VisibilityFilter>('all')
const typeFilter = ref<string>('')

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
const newLoc = ref({ name: '', type: 'city' as any, description: '', hexKey: '' })

// Edit location state
const editingLocation = ref<CampaignLocation | null>(null)
const editLocForm = ref({ name: '', type: 'city' as any, description: '', hexKey: '' })

const { locationTypes: locationTypeOptions } = useTypeConfig()
const typeIcons: Record<string, string> = {
  city: '🏛️', town: '🏠', village: '🛖', castle: '🏰', fortress: '🛡️',
  monastery: '📿', camp: '⛺', ruins: '🪨', other: '📍'
}

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name', 'asc')), (snap) => {
    locations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
    loading.value = false
  }, (e) => {
    console.error('Failed to load locations:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'features'), orderBy('name', 'asc')), (snap) => {
    features.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
  }, (e) => {
    console.error('Failed to load features:', e)
  }))
})

const filteredLocations = computed(() => {
  let result = locations.value

  // Visibility filter
  if (!(auth.isDm || auth.isAdmin)) {
    result = result.filter(l => !l.hidden)
  } else if (visibilityFilter.value === 'visible') {
    result = result.filter(l => !l.hidden)
  } else if (visibilityFilter.value === 'hidden') {
    result = result.filter(l => l.hidden)
  }

  // Type filter
  if (typeFilter.value) {
    result = result.filter(l => l.type === typeFilter.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(l => l.name.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
  }

  return result
})

function getFeatureCount(locId: string): number {
  return features.value.filter(f => f.locationId === locId).length
}

async function addLocation() {
  if (!newLoc.value.name.trim()) return
  await addDoc(collection(db, 'locations'), {
    name: newLoc.value.name.trim(),
    type: newLoc.value.type,
    description: newLoc.value.description.trim(),
    hexKey: newLoc.value.hexKey.trim() || null,
    tags: [],
    discoveredBy: auth.firebaseUser?.uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  // onSnapshot will update the list automatically
  newLoc.value = { name: '', type: 'city', description: '', hexKey: '' }
  showAddForm.value = false
}

async function deleteLocation(loc: CampaignLocation) {
  if (!confirm(`Delete "${loc.name}" and all its features?`)) return
  try {
    // Delete associated features
    const featSnap = await getDocs(query(collection(db, 'features'), where('locationId', '==', loc.id)))
    await Promise.all(featSnap.docs.map(d => deleteDoc(d.ref)))
    // Delete the location
    await deleteDoc(doc(db, 'locations', loc.id))
    // onSnapshot will update lists automatically
  } catch (e) {
    console.error('Failed to delete:', e)
    alert('Failed to delete location.')
  }
}

async function toggleHidden(loc: CampaignLocation) {
  const newHidden = !loc.hidden
  try {
    await updateDoc(doc(db, 'locations', loc.id), { hidden: newHidden, updatedAt: Timestamp.now() })
    // onSnapshot will update the list automatically
  } catch (e) {
    console.error('Failed to toggle hidden:', e)
    alert('Failed to update location.')
  }
}

function startEditLocation(loc: CampaignLocation) {
  editingLocation.value = loc
  editLocForm.value = {
    name: loc.name,
    type: loc.type,
    description: loc.description || '',
    hexKey: loc.hexKey || ''
  }
}

async function saveEditLocation() {
  if (!editingLocation.value || !editLocForm.value.name.trim()) return
  const id = editingLocation.value.id
  const updates = {
    name: editLocForm.value.name.trim(),
    type: editLocForm.value.type,
    description: editLocForm.value.description.trim(),
    hexKey: editLocForm.value.hexKey.trim() || null,
    updatedAt: Timestamp.now()
  }
  try {
    await updateDoc(doc(db, 'locations', id), updates)
    // onSnapshot will update the list automatically
    editingLocation.value = null
  } catch (e) {
    console.error('Failed to update location:', e)
    alert('Failed to save.')
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📍 Locations</h1>
      <div class="flex items-center gap-3">
        <span class="text-zinc-600 text-sm">{{ filteredLocations.length }} locations</span>
        <button @click="showAddForm = !showAddForm" class="btn !text-xs !py-1.5">{{ showAddForm ? 'Cancel' : '+ Add' }}</button>
      </div>
    </div>

    <!-- Add Form -->
    <div v-if="showAddForm" class="card p-5 mb-5 relative z-10">
      <div class="relative z-10">
        <h3 class="label mb-3">Add Location</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input v-model="newLoc.name" placeholder="Name" class="input" />
          <TypeSelect v-model="newLoc.type" :options="locationTypeOptions" />
          <input v-model="newLoc.hexKey" placeholder="Hex (e.g. 25_30)" class="input" />
          <div></div>
          <textarea v-model="newLoc.description" placeholder="Description..." class="input md:col-span-2" rows="2" />
          <button @click="addLocation" :disabled="!newLoc.name.trim()" class="btn !py-2">Add Location</button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card-flat p-3 mb-5 flex flex-wrap items-center gap-3">
      <input v-model="searchQuery" type="text" placeholder="Search..." class="input flex-1 min-w-[180px] max-w-sm !bg-white/[0.03]" />

      <!-- Type filter -->
      <div class="flex items-center gap-1.5">
        <img v-if="typeFilter" :src="locationTypeOptions.find(o => o.key === typeFilter)?.iconUrl || ''" class="w-4 h-4 object-contain" />
        <select v-model="typeFilter" class="input !w-auto !bg-white/[0.03] text-sm">
          <option value="">All types</option>
          <option v-for="t in locationTypeOptions" :key="t.key" :value="t.key">{{ t.label }}</option>
        </select>
      </div>

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
      <span class="text-zinc-600 text-xs ml-auto">{{ filteredLocations.length }} result{{ filteredLocations.length !== 1 ? 's' : '' }}</span>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="filteredLocations.length === 0" class="card p-10 text-center relative z-10">
      <div class="relative z-10 text-zinc-600">No locations discovered yet.</div>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      <RouterLink
        v-for="loc in filteredLocations" :key="loc.id"
        :to="`/locations/${loc.id}`"
        :class="['card relative z-10 group cursor-pointer', loc.hidden ? '!border-amber-500/40 !border-dashed !border-2' : '']"
      >
        <div class="relative z-10">
          <!-- Hidden banner -->
          <div v-if="loc.hidden" :class="['bg-amber-500/20 border-b-2 border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-widest text-center py-1.5 z-10', (loc.mapImageUrl || loc.imageUrl) ? 'absolute top-0 left-0 right-0' : '']" style="font-family: Manrope, sans-serif">🚫 Hidden from players</div>
          <img v-if="loc.mapImageUrl || loc.imageUrl" :src="loc.mapImageUrl || loc.imageUrl" :class="['w-full h-36 object-cover rounded-t-xl -mt-px -mx-px', loc.hidden ? 'grayscale opacity-60' : '']" style="width: calc(100% + 2px)" />
          <div class="p-5">
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-lg shrink-0">{{ typeIcons[loc.type] || '📍' }}</span>
                <h3 class="text-base font-semibold text-white group-hover:text-[#ef233c] transition-colors truncate" style="font-family: Manrope, sans-serif">{{ loc.name }}</h3>
                <span v-if="loc.hidden && (auth.isDm || auth.isAdmin)" class="text-xs text-amber-400/70 shrink-0" title="Hidden from players">🚫</span>
              </div>
              <!-- DM/Admin action buttons (always visible) -->
              <div v-if="auth.isDm || auth.isAdmin" class="flex gap-1 shrink-0">
                <button @click.prevent.stop="toggleHidden(loc)" :class="['text-zinc-600 hover:text-amber-400 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors', loc.hidden ? '!text-amber-400' : '']" :title="loc.hidden ? 'Show to players' : 'Hide from players'">{{ loc.hidden ? '🚫' : '👁️' }}</button>
                <button @click.prevent.stop="startEditLocation(loc)" class="text-zinc-600 hover:text-zinc-300 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors" title="Edit">✏️</button>
                <button @click.prevent.stop="deleteLocation(loc)" class="text-zinc-600 hover:text-red-400 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors" title="Delete">🗑️</button>
              </div>
            </div>
            <div class="flex items-center gap-2 mb-2">
              <span class="badge bg-white/5 text-zinc-500">{{ loc.type }}</span>
              <span v-if="loc.hexKey" class="text-xs text-zinc-600 cursor-default" @mouseenter="showMiniMap(loc.hexKey!, $event)" @mouseleave="hideMiniMap" @click.prevent.stop="toggleMiniMap(loc.hexKey!, $event)">📍 Hex {{ loc.hexKey }}</span>
              <span v-if="getFeatureCount(loc.id)" class="text-xs text-zinc-600">· {{ getFeatureCount(loc.id) }} features</span>
            </div>
            <p class="text-sm text-zinc-500 line-clamp-2">{{ loc.description }}</p>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Edit Location Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="editingLocation" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="editingLocation = null" />
          <div class="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-3 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit Location</h3>
              <button @click="editingLocation = null" class="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            <input v-model="editLocForm.name" placeholder="Name" class="input w-full" />
            <TypeSelect v-model="editLocForm.type" :options="locationTypeOptions" input-class="w-full" />
            <input v-model="editLocForm.hexKey" placeholder="Hex (e.g. 25_30)" class="input w-full" />
            <textarea v-model="editLocForm.description" placeholder="Description..." class="input w-full" rows="3" />
            <div class="flex justify-end gap-2">
              <button @click="editingLocation = null" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEditLocation" :disabled="!editLocForm.name.trim()" class="btn text-sm">Save</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Mini map hover popup (teleported to escape card overflow) -->
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

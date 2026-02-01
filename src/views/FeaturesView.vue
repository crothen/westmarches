<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import HexMiniMap from '../components/map/HexMiniMap.vue'
import type { CampaignLocation, LocationFeature } from '../types'
import { getIconPath } from '../lib/icons'
import MentionTextarea from '../components/common/MentionTextarea.vue'

const auth = useAuthStore()
const locations = ref<CampaignLocation[]>([])
const features = ref<LocationFeature[]>([])
const loading = ref(true)
const searchQuery = ref('')
const showAddForm = ref(false)

const newFeat = ref({ name: '', type: 'other' as any, description: '', locationId: '', hexKey: '' })
type VisibilityFilter = 'all' | 'visible' | 'hidden'
const visibilityFilter = ref<VisibilityFilter>('all')
const typeFilter = ref<string>('')
const locationFilter = ref<string>('')

// Edit state
const editingFeature = ref<LocationFeature | null>(null)
const editForm = ref({ name: '', type: 'other' as any, description: '' })

const featureTypes = ['inn', 'shop', 'temple', 'shrine', 'blacksmith', 'tavern', 'guild', 'market', 'gate', 'tower', 'ruins', 'cave', 'bridge', 'well', 'monument', 'graveyard', 'dock', 'warehouse', 'barracks', 'library', 'other']

onMounted(async () => {
  try {
    const [locSnap, featSnap] = await Promise.all([
      getDocs(query(collection(db, 'locations'), orderBy('name', 'asc'))),
      getDocs(query(collection(db, 'features'), orderBy('name', 'asc')))
    ])
    locations.value = locSnap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
    features.value = featSnap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
  } catch (e) {
    console.error('Failed to load:', e)
  } finally {
    loading.value = false
  }
})

const filteredFeatures = computed(() => {
  let result = features.value

  // Visibility filter
  if (!(auth.isDm || auth.isAdmin)) {
    result = result.filter(f => !f.hidden)
  } else if (visibilityFilter.value === 'visible') {
    result = result.filter(f => !f.hidden)
  } else if (visibilityFilter.value === 'hidden') {
    result = result.filter(f => f.hidden)
  }

  // Type filter
  if (typeFilter.value) {
    result = result.filter(f => f.type === typeFilter.value)
  }

  // Location filter
  if (locationFilter.value) {
    result = result.filter(f => f.locationId === locationFilter.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(f => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
  }
  return result
})

function getLocationName(locId: string): string {
  return locations.value.find(l => l.id === locId)?.name || 'Unknown'
}

function getFeatureHexKey(feat: LocationFeature): string | null {
  if (feat.hexKey) return feat.hexKey
  if (feat.locationId) {
    const loc = locations.value.find(l => l.id === feat.locationId)
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
onUnmounted(() => document.removeEventListener('click', onGlobalClick))

async function addFeature() {
  if (!newFeat.value.name.trim()) return
  const docRef = await addDoc(collection(db, 'features'), {
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
  features.value.push({ id: docRef.id, ...newFeat.value, tags: [], createdAt: new Date(), updatedAt: new Date() } as any)
  features.value.sort((a, b) => a.name.localeCompare(b.name))
  newFeat.value = { name: '', type: 'other', description: '', locationId: '', hexKey: '' }
  showAddForm.value = false
}

async function toggleHidden(feat: LocationFeature) {
  const newHidden = !feat.hidden
  try {
    await updateDoc(doc(db, 'features', feat.id), { hidden: newHidden, updatedAt: Timestamp.now() })
    const idx = features.value.findIndex(f => f.id === feat.id)
    if (idx >= 0) features.value[idx] = { ...features.value[idx], hidden: newHidden } as LocationFeature
  } catch (e) {
    console.error('Failed to toggle hidden:', e)
  }
}

function startEdit(feat: LocationFeature) {
  editingFeature.value = feat
  editForm.value = { name: feat.name, type: feat.type, description: feat.description || '' }
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
    const idx = features.value.findIndex(f => f.id === id)
    if (idx >= 0) features.value[idx] = { ...features.value[idx], ...updates } as unknown as LocationFeature
    editingFeature.value = null
  } catch (e) {
    console.error('Failed to save:', e)
    alert('Failed to save changes.')
  }
}

async function deleteFeature(feat: LocationFeature) {
  if (!confirm(`Delete "${feat.name}"? This cannot be undone.`)) return
  try {
    await deleteDoc(doc(db, 'features', feat.id))
    features.value = features.value.filter(f => f.id !== feat.id)
  } catch (e) {
    console.error('Failed to delete:', e)
    alert('Failed to delete feature.')
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📌 Points of Interest</h1>
      <div class="flex items-center gap-3">
        <span class="text-zinc-600 text-sm">{{ filteredFeatures.length }} POIs</span>
        <button @click="showAddForm = !showAddForm" class="btn !text-xs !py-1.5">{{ showAddForm ? 'Cancel' : '+ Add' }}</button>
      </div>
    </div>

    <!-- Add Form -->
    <div v-if="showAddForm" class="card p-5 mb-5 relative z-10">
      <div class="relative z-10">
        <h3 class="label mb-3">Add Point of Interest</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input v-model="newFeat.name" placeholder="Name" class="input" />
          <select v-model="newFeat.type" class="input">
            <option v-for="t in featureTypes" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
          </select>
          <select v-model="newFeat.locationId" class="input">
            <option value="">No parent location (standalone)</option>
            <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
          </select>
          <input v-model="newFeat.hexKey" placeholder="Hex (e.g. 25_30) — for standalone" class="input" />
          <MentionTextarea v-model="newFeat.description" placeholder="Description..." input-class="md:col-span-2" :rows="2" />
          <button @click="addFeature" :disabled="!newFeat.name.trim()" class="btn !py-2">Add Feature</button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card-flat p-3 mb-5 flex flex-wrap items-center gap-3">
      <input v-model="searchQuery" type="text" placeholder="Search..." class="input flex-1 min-w-[180px] max-w-sm !bg-white/[0.03]" />

      <!-- Type filter -->
      <select v-model="typeFilter" class="input !w-auto !bg-white/[0.03] text-sm">
        <option value="">All types</option>
        <option v-for="t in featureTypes" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
      </select>

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
      <span class="text-zinc-600 text-xs ml-auto">{{ filteredFeatures.length }} result{{ filteredFeatures.length !== 1 ? 's' : '' }}</span>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="filteredFeatures.length === 0" class="card p-10 text-center relative z-10">
      <div class="relative z-10 text-zinc-600">No points of interest discovered yet.</div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <div v-for="feat in filteredFeatures" :key="feat.id" :class="['card relative z-10', feat.hidden ? '!border-amber-500/40 !border-dashed !border-2' : '']">
        <div class="relative z-10 p-5">
          <!-- Hidden banner -->
          <div v-if="feat.hidden" class="absolute top-0 left-0 right-0 bg-amber-500/20 border-b-2 border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-widest text-center py-1.5 z-10 rounded-t-xl" style="font-family: Manrope, sans-serif">🚫 Hidden from players</div>
          <div :class="feat.hidden ? 'mt-5' : ''">
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 min-w-0">
                <img :src="getIconPath(feat.type)" class="w-6 h-6 object-contain" :alt="feat.type" />
                <h3 class="text-base font-semibold text-white truncate" style="font-family: Manrope, sans-serif">{{ feat.name }}</h3>
              </div>
              <div v-if="auth.isDm || auth.isAdmin" class="flex gap-1 shrink-0">
                <button @click="toggleHidden(feat)" :class="['text-zinc-600 hover:text-amber-400 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors', feat.hidden ? '!text-amber-400' : '']" :title="feat.hidden ? 'Show to players' : 'Hide from players'">{{ feat.hidden ? '🚫' : '👁️' }}</button>
                <button @click="startEdit(feat)" class="text-zinc-600 hover:text-zinc-300 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors" title="Edit">✏️</button>
                <button @click="deleteFeature(feat)" class="text-zinc-600 hover:text-red-400 rounded-md w-8 h-8 flex items-center justify-center text-sm transition-colors" title="Delete">🗑️</button>
              </div>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="badge bg-white/5 text-zinc-500">{{ feat.type }}</span>
              <RouterLink v-if="feat.locationId" :to="`/locations/${feat.locationId}`" class="text-xs text-zinc-500 hover:text-[#ef233c] transition-colors">
                in {{ getLocationName(feat.locationId) }}
              </RouterLink>
              <span v-if="getFeatureHexKey(feat)" class="text-xs text-zinc-600 cursor-default" @mouseenter="showMiniMap(getFeatureHexKey(feat)!, $event)" @mouseleave="hideMiniMap" @click.prevent.stop="toggleMiniMap(getFeatureHexKey(feat)!, $event)">📍 Hex {{ getFeatureHexKey(feat) }}</span>
            </div>
            <p class="text-sm text-zinc-500">{{ feat.description }}</p>
          </div>
        </div>
      </div>
    </div>

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
              <select v-model="editForm.type" class="input w-full">
                <option v-for="t in featureTypes" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
              </select>
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

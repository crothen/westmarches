<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, collection, query, where, addDoc, updateDoc, deleteDoc, Timestamp, onSnapshot } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import LocationMapViewer from '../components/map/LocationMapViewer.vue'
import HexMiniMap from '../components/map/HexMiniMap.vue'
import MentionTextarea from '../components/common/MentionTextarea.vue'
import { useTypeConfig } from '../composables/useTypeConfig'
import TypeSelect from '../components/common/TypeSelect.vue'
import MentionText from '../components/common/MentionText.vue'
import type { CampaignLocation, LocationFeature, HexMarker, MarkerType, SessionEntry, SessionLog, SessionEntryType } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

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
const location = ref<CampaignLocation | null>(null)
const features = ref<LocationFeature[]>([])
const loading = ref(true)
const showAddFeature = ref(false)
const uploadingMap = ref(false)
const uploadProgress = ref(0)
const placingFeature = ref<string | null>(null)
const placingSubLocation = ref<string | null>(null)
const highlightedFeature = ref<string | null>(null)
const highlightedSubLocation = ref<string | null>(null)

const { locationTypes: locationTypeOptions, featureTypes: featureTypeOptions, pinTypes: pinTypeOptions, getIconUrl } = useTypeConfig()

// Quick-add from map click
const showQuickAdd = ref(false)
const quickAddPos = ref({ x: 0, y: 0 })
const quickAddKind = ref<'feature' | 'pin'>('feature')
const quickAddForm = ref({ name: '', type: 'other' as any, description: '' })
const quickAddPinForm = ref({ name: '', type: 'clue' as MarkerType, description: '', isPrivate: false })

const newFeat = ref({ name: '', type: 'other' as any, description: '' })
const showAddSubLocation = ref(false)
const newSubLoc = ref({ name: '', type: 'other' as any, description: '' })

// featureTypes kept for backward compat fallback
// const featureTypes = ['inn', 'shop', 'temple', 'shrine', 'blacksmith', 'tavern', 'guild', 'market', 'gate', 'tower', 'ruins', 'cave', 'bridge', 'well', 'monument', 'graveyard', 'dock', 'warehouse', 'barracks', 'library', 'other']

// Sub-locations (Feature 3 - nested/recursive locations)
const subLocations = ref<CampaignLocation[]>([])
const locationMarkers = ref<HexMarker[]>([])

// Timeline entries state
const timelineEntries = ref<SessionEntry[]>([])
const timelineSessions = ref<Map<string, SessionLog>>(new Map())
const loadingTimeline = ref(true)

const entryTypeConfig: Record<SessionEntryType, { icon: string; label: string; color: string }> = {
  interaction: { icon: '🤝', label: 'Interaction', color: 'bg-purple-500/15 text-purple-400' },
  task: { icon: '✅', label: 'Task', color: 'bg-green-500/15 text-green-400' },
  encounter: { icon: '⚔️', label: 'Encounter', color: 'bg-red-500/15 text-red-400' },
  discovery: { icon: '🔍', label: 'Discovery', color: 'bg-blue-500/15 text-blue-400' },
  travel: { icon: '🚶', label: 'Travel', color: 'bg-amber-500/15 text-amber-400' },
  rest: { icon: '🏕️', label: 'Rest', color: 'bg-teal-500/15 text-teal-400' },
  custom: { icon: '📝', label: 'Custom', color: 'bg-zinc-500/15 text-zinc-400' },
}

const entriesBySession = computed(() => {
  const groups = new Map<string, SessionEntry[]>()
  for (const entry of timelineEntries.value) {
    if (!groups.has(entry.sessionId)) groups.set(entry.sessionId, [])
    groups.get(entry.sessionId)!.push(entry)
  }
  const sorted = [...groups.entries()].sort((a, b) => {
    const sa = timelineSessions.value.get(a[0])
    const sb = timelineSessions.value.get(b[0])
    const da = sa?.date ? ((sa.date as any).toDate ? (sa.date as any).toDate() : new Date(sa.date)) : new Date(0)
    const db_ = sb?.date ? ((sb.date as any).toDate ? (sb.date as any).toDate() : new Date(sb.date)) : new Date(0)
    return db_.getTime() - da.getTime()
  })
  return sorted
})

function formatSessionDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const _unsubs: (() => void)[] = []

onMounted(() => {
  const locationId = route.params.id as string

  // Listen to timeline entries linked to this location
  _unsubs.push(onSnapshot(
    query(collection(db, 'sessionEntries'), where('linkedLocationIds', 'array-contains', locationId)),
    (snap) => {
      timelineEntries.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEntry))
      const sessionIds = [...new Set(timelineEntries.value.map(e => e.sessionId))]
      for (const sid of sessionIds) {
        if (!timelineSessions.value.has(sid)) {
          _unsubs.push(onSnapshot(doc(db, 'sessions', sid), (ssnap) => {
            if (ssnap.exists()) {
              timelineSessions.value.set(sid, { id: ssnap.id, ...ssnap.data() } as SessionLog)
            }
          }))
        }
      }
      loadingTimeline.value = false
    },
    (err) => {
      console.warn('Location timeline entries query error:', err.message)
      loadingTimeline.value = false
    }
  ))

  // Listen to location document
  _unsubs.push(onSnapshot(doc(db, 'locations', locationId), (snap) => {
    if (snap.exists()) {
      location.value = { id: snap.id, ...snap.data() } as CampaignLocation
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load location:', e)
    loading.value = false
  }))

  // Listen to features for this location
  _unsubs.push(onSnapshot(query(collection(db, 'features'), where('locationId', '==', locationId)), (snap) => {
    features.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
  }, (e) => console.warn('Failed to load features:', e)))

  // Listen to sub-locations
  _unsubs.push(onSnapshot(query(collection(db, 'locations'), where('parentLocationId', '==', locationId)), (snap) => {
    subLocations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
  }, (e) => console.warn('Failed to load sub-locations:', e)))

  // Listen to markers for this location
  _unsubs.push(onSnapshot(query(collection(db, 'markers'), where('locationId', '==', locationId)), (snap) => {
    locationMarkers.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as HexMarker))
  }, (e) => console.warn('Failed to load location markers:', e)))
})

async function uploadMapImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !location.value) return

  uploadingMap.value = true
  uploadProgress.value = 0

  const ext = file.name.split('.').pop() || 'png'
  const fileRef = storageRef(storage, `location-maps/${location.value.id}/map.${ext}`)
  const uploadTask = uploadBytesResumable(fileRef, file)

  uploadTask.on('state_changed',
    (snapshot) => { uploadProgress.value = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) },
    (error) => { console.error('Upload failed:', error); uploadingMap.value = false },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      await updateDoc(doc(db, 'locations', location.value!.id), { mapImageUrl: url })
      location.value!.mapImageUrl = url
      uploadingMap.value = false
      uploadProgress.value = 0
    }
  )
}

async function onPlaceFeature(featureId: string, x: number, y: number) {
  // Cancel signal
  if (!featureId) {
    placingFeature.value = null
    return
  }
  await updateDoc(doc(db, 'features', featureId), { mapPosition: { x, y } })
  const idx = features.value.findIndex(f => f.id === featureId)
  if (idx >= 0) {
    features.value[idx] = { ...features.value[idx], mapPosition: { x, y } } as LocationFeature
  }
  placingFeature.value = null
}

async function onPlaceSubLocation(locationId: string, x: number, y: number) {
  if (!locationId) {
    placingSubLocation.value = null
    return
  }
  await updateDoc(doc(db, 'locations', locationId), { mapPosition: { x, y } })
  const idx = subLocations.value.findIndex(l => l.id === locationId)
  if (idx >= 0) {
    subLocations.value[idx] = { ...subLocations.value[idx], mapPosition: { x, y } } as CampaignLocation
  }
  placingSubLocation.value = null
}

function onClickSubLocation(loc: CampaignLocation) {
  router.push(`/locations/${loc.id}`)
}

async function removeSubLocationFromMap(loc: CampaignLocation) {
  try {
    await updateDoc(doc(db, 'locations', loc.id), { mapPosition: null })
    const idx = subLocations.value.findIndex(l => l.id === loc.id)
    if (idx >= 0) {
      subLocations.value[idx] = { ...subLocations.value[idx], mapPosition: undefined } as CampaignLocation
    }
  } catch (e) {
    console.error('Failed to remove sub-location from map:', e)
  }
}

function onMapClick(x: number, y: number) {
  // Only show quick-add if not placing an existing feature
  if (placingFeature.value) return
  quickAddPos.value = { x, y }
  quickAddKind.value = 'feature'
  quickAddForm.value = { name: '', type: 'other', description: '' }
  quickAddPinForm.value = { name: '', type: 'clue' as MarkerType, description: '', isPrivate: false }
  showQuickAdd.value = true
}

async function quickAddFeature() {
  if (!quickAddForm.value.name.trim() || !location.value) return
  const docRef = await addDoc(collection(db, 'features'), {
    name: quickAddForm.value.name.trim(),
    type: quickAddForm.value.type,
    description: quickAddForm.value.description.trim(),
    locationId: location.value.id,
    hexKey: location.value.hexKey || null,
    mapPosition: quickAddPos.value,
    tags: [],
    discoveredBy: auth.firebaseUser?.uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  features.value.push({
    id: docRef.id,
    name: quickAddForm.value.name.trim(),
    type: quickAddForm.value.type,
    description: quickAddForm.value.description.trim(),
    locationId: location.value.id,
    mapPosition: quickAddPos.value,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date()
  } as LocationFeature)
  showQuickAdd.value = false
}

async function quickAddPin() {
  if (!quickAddPinForm.value.name.trim() || !location.value) return
  const docRef = await addDoc(collection(db, 'markers'), {
    name: quickAddPinForm.value.name.trim(),
    type: quickAddPinForm.value.type,
    description: quickAddPinForm.value.description.trim(),
    locationId: location.value.id,
    hexKey: location.value.hexKey || null,
    mapPosition: quickAddPos.value,
    isPrivate: quickAddPinForm.value.isPrivate,
    tags: [],
    createdBy: auth.firebaseUser?.uid || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  locationMarkers.value.push({
    id: docRef.id,
    name: quickAddPinForm.value.name.trim(),
    type: quickAddPinForm.value.type,
    description: quickAddPinForm.value.description.trim(),
    locationId: location.value.id,
    mapPosition: quickAddPos.value,
    isPrivate: quickAddPinForm.value.isPrivate,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date()
  } as unknown as HexMarker)
  showQuickAdd.value = false
}

function onClickFeature(feat: LocationFeature) {
  // Could navigate to feature detail in the future; for now scroll to it in the list
  const el = document.getElementById('feat-' + feat.id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function addSubLocation() {
  if (!newSubLoc.value.name.trim() || !location.value) return
  try {
    const data = {
      name: newSubLoc.value.name.trim(),
      type: newSubLoc.value.type,
      description: newSubLoc.value.description.trim(),
      parentLocationId: location.value.id,
      hexKey: location.value.hexKey || null,
      tags: [],
      discoveredBy: auth.firebaseUser?.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }
    const docRef = await addDoc(collection(db, 'locations'), data)
    subLocations.value.push({ id: docRef.id, ...data } as any)
    newSubLoc.value = { name: '', type: 'other', description: '' }
    showAddSubLocation.value = false
  } catch (e) {
    console.error('Failed to add sub-location:', e)
    alert('Failed to add sub-location.')
  }
}

async function addFeature() {
  if (!newFeat.value.name.trim() || !location.value) return
  const docRef = await addDoc(collection(db, 'features'), {
    name: newFeat.value.name.trim(),
    type: newFeat.value.type,
    description: newFeat.value.description.trim(),
    locationId: location.value.id,
    hexKey: location.value.hexKey || null,
    tags: [],
    discoveredBy: auth.firebaseUser?.uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  features.value.push({ id: docRef.id, ...newFeat.value, locationId: location.value.id, tags: [], createdAt: new Date(), updatedAt: new Date() } as any)
  newFeat.value = { name: '', type: 'other', description: '' }
  showAddFeature.value = false
}

// --- Feature edit/delete ---
const editingFeature = ref<LocationFeature | null>(null)
const editFeatForm = ref({ name: '', type: 'other' as any, description: '' })
const savingFeature = ref(false)

function startEditFeature(feat: LocationFeature) {
  editingFeature.value = feat
  editFeatForm.value = { name: feat.name, type: feat.type, description: feat.description || '' }
}

async function saveEditFeature() {
  if (!editingFeature.value || !editFeatForm.value.name.trim()) return
  savingFeature.value = true
  const id = editingFeature.value.id
  const updates = {
    name: editFeatForm.value.name.trim(),
    type: editFeatForm.value.type,
    description: editFeatForm.value.description.trim(),
    updatedAt: Timestamp.now()
  }
  try {
    await updateDoc(doc(db, 'features', id), updates)
    const idx = features.value.findIndex(f => f.id === id)
    if (idx >= 0) {
      features.value[idx] = { ...features.value[idx], name: updates.name, type: updates.type, description: updates.description } as LocationFeature
    }
    editingFeature.value = null
  } catch (e) {
    console.error('Failed to update feature:', e)
    alert('Failed to save.')
  } finally {
    savingFeature.value = false
  }
}

async function deleteFeature(feat: LocationFeature) {
  if (!confirm(`Delete "${feat.name}"?`)) return
  try {
    await deleteDoc(doc(db, 'features', feat.id))
    features.value = features.value.filter(f => f.id !== feat.id)
  } catch (e) {
    console.error('Failed to delete feature:', e)
    alert('Failed to delete.')
  }
}

async function removeFeatureFromMap(feat: LocationFeature) {
  try {
    await updateDoc(doc(db, 'features', feat.id), { mapPosition: null })
    const idx = features.value.findIndex(f => f.id === feat.id)
    if (idx >= 0) {
      features.value[idx] = { ...features.value[idx], mapPosition: undefined } as LocationFeature
    }
  } catch (e) {
    console.error('Failed to remove from map:', e)
  }
}

async function deleteLocation() {
  if (!location.value) return
  if (!confirm(`Delete "${location.value.name}" and all its features?`)) return
  try {
    // Delete all features belonging to this location
    for (const feat of features.value) {
      await deleteDoc(doc(db, 'features', feat.id))
    }
    // Delete the location itself
    await deleteDoc(doc(db, 'locations', location.value.id))
    router.push('/locations')
  } catch (e) {
    console.error('Failed to delete location:', e)
    alert('Failed to delete location.')
  }
}

// --- Hidden/Discovered mechanic ---
const visibleFeatures = computed(() => {
  if (auth.isDm || auth.isAdmin) return features.value
  return features.value.filter(f => !f.hidden)
})

// Redirect players away from hidden locations
watch(location, (loc) => {
  if (loc && loc.hidden && !(auth.isDm || auth.isAdmin)) {
    router.replace('/locations')
  }
}, { immediate: true })

async function toggleLocationHidden() {
  if (!location.value) return
  const newHidden = !location.value.hidden
  try {
    await updateDoc(doc(db, 'locations', location.value.id), { hidden: newHidden, updatedAt: Timestamp.now() })
    location.value = { ...location.value, hidden: newHidden } as CampaignLocation
  } catch (e) {
    console.error('Failed to toggle hidden:', e)
    alert('Failed to update.')
  }
}

async function toggleFeatureHidden(feat: LocationFeature) {
  const newHidden = !feat.hidden
  try {
    await updateDoc(doc(db, 'features', feat.id), { hidden: newHidden, updatedAt: Timestamp.now() })
    const idx = features.value.findIndex(f => f.id === feat.id)
    if (idx >= 0) {
      features.value[idx] = { ...features.value[idx], hidden: newHidden } as LocationFeature
    }
  } catch (e) {
    console.error('Failed to toggle feature hidden:', e)
    alert('Failed to update.')
  }
}


</script>

<template>
  <div>
    <RouterLink to="/locations" class="text-[#ef233c] hover:text-red-400 text-sm transition-colors mb-4 inline-block">← Back to Locations</RouterLink>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>
    <div v-else-if="!location" class="card p-10 text-center relative z-10"><div class="relative z-10 text-zinc-600">Location not found.</div></div>

    <div v-else>
      <!-- Header -->
      <div class="flex items-center gap-3 mb-2">
        <img :src="getIconUrl(location.type)" class="w-8 h-8 object-contain" :alt="location.type" />
        <h1 class="text-3xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">{{ location.name }}</h1>
        <span class="badge bg-white/5 text-zinc-500">{{ location.type }}</span>
        <span v-if="location.hidden && (auth.isDm || auth.isAdmin)" class="badge bg-amber-500/15 text-amber-400 text-xs">👁️‍🗨️ Hidden</span>
        <span class="flex-1"></span>
        <button v-if="auth.isDm || auth.isAdmin" @click="toggleLocationHidden" :class="['text-sm transition-colors mr-2', location.hidden ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-amber-400']" :title="location.hidden ? 'Show to players' : 'Hide from players'">{{ location.hidden ? '👁️‍🗨️ Reveal' : '👁️ Hide' }}</button>
        <button v-if="auth.isDm || auth.isAdmin" @click="deleteLocation" class="text-zinc-600 hover:text-red-400 transition-colors text-sm" title="Delete location">🗑️ Delete</button>
      </div>
      <p v-if="location.hexKey" class="text-zinc-600 text-sm mb-2 inline-block cursor-default" @mouseenter="showMiniMap(location.hexKey!, $event)" @mouseleave="hideMiniMap" @click.stop="toggleMiniMap(location.hexKey!, $event)">📍 Hex {{ location.hexKey }}</p>
      <p v-if="location.parentLocationId" class="text-zinc-600 text-sm mb-2">
        <RouterLink :to="`/locations/${location.parentLocationId}`" class="text-[#ef233c] hover:text-red-400 transition-colors">↑ Parent location</RouterLink>
      </p>
      <p class="text-zinc-400 mb-6"><MentionText :text="location.description" /></p>

      <!-- Location Image -->
      <div v-if="location.imageUrl" class="mb-6">
        <img :src="location.imageUrl" class="w-full max-h-64 object-cover rounded-xl border border-white/10" />
      </div>

      <!-- Interactive Map Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="label">Location Map</h2>
          <div v-if="location.mapImageUrl && (auth.isDm || auth.isAdmin)" class="flex gap-2">
            <input type="file" accept="image/*" @change="uploadMapImage" class="hidden" id="reupload-map" />
            <label for="reupload-map" class="btn-ghost !text-[0.6rem] !py-1 !px-2 cursor-pointer">📤 Re-upload</label>
          </div>
        </div>

        <div v-if="location.mapImageUrl">
          <LocationMapViewer
            :mapUrl="location.mapImageUrl"
            :features="features"
            :subLocations="subLocations"
            :placingFeature="placingFeature"
            :placingSubLocation="placingSubLocation"
            :highlightedFeatureId="highlightedFeature"
            :highlightedSubLocationId="highlightedSubLocation"
            :maxHeight="400"
            :isInteractive="true"
            @place="onPlaceFeature"
            @place-sublocation="onPlaceSubLocation"
            @click-feature="onClickFeature"
            @click-sublocation="onClickSubLocation"
            @map-click="onMapClick"
          />
          <p class="text-zinc-600 text-[0.6rem] mt-1.5">Scroll/pinch to zoom · Drag to pan · Click/tap to add a marker</p>
        </div>

        <div v-else class="card-flat p-6 text-center">
          <p class="text-zinc-600 text-sm mb-3">No map uploaded yet.</p>
          <div v-if="auth.isDm || auth.isAdmin">
            <div v-if="uploadingMap" class="max-w-xs mx-auto">
              <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full bg-[#ef233c] rounded-full transition-all" :style="{ width: uploadProgress + '%' }"></div>
              </div>
            </div>
            <input v-else type="file" accept="image/*" @change="uploadMapImage" class="text-xs text-zinc-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:text-zinc-400 file:text-xs file:cursor-pointer hover:file:bg-white/10" />
          </div>
        </div>
      </div>

      <!-- Quick Add Modal (Feature or Pin) -->
      <Teleport to="body">
        <transition
          enter-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0" enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-150"
          leave-from-class="opacity-100" leave-to-class="opacity-0"
        >
          <div v-if="showQuickAdd" class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showQuickAdd = false" />
            <div class="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-3 z-10">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">📌 Add to Map</h3>
                <button @click="showQuickAdd = false" class="text-zinc-500 hover:text-white transition-colors">✕</button>
              </div>

              <!-- Kind toggle -->
              <div class="flex gap-1">
                <button @click="quickAddKind = 'feature'" :class="['flex-1 text-xs py-1.5 rounded-lg transition-colors', quickAddKind === 'feature' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/5 text-zinc-500 hover:text-zinc-300']">📌 Feature</button>
                <button @click="quickAddKind = 'pin'" :class="['flex-1 text-xs py-1.5 rounded-lg transition-colors', quickAddKind === 'pin' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/5 text-zinc-500 hover:text-zinc-300']">📍 Pin</button>
              </div>

              <!-- Feature form -->
              <template v-if="quickAddKind === 'feature'">
                <input v-model="quickAddForm.name" placeholder="Name" class="input w-full" @keyup.enter="quickAddFeature" />
                <TypeSelect v-model="quickAddForm.type" :options="featureTypeOptions" input-class="w-full" />
                <MentionTextarea v-model="quickAddForm.description" placeholder="Description (optional)" :rows="2" />
                <div class="flex justify-end gap-2">
                  <button @click="showQuickAdd = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                  <button @click="quickAddFeature" :disabled="!quickAddForm.name.trim()" class="btn text-sm">Add Feature</button>
                </div>
              </template>

              <!-- Pin form -->
              <template v-else>
                <input v-model="quickAddPinForm.name" placeholder="Name" class="input w-full" @keyup.enter="quickAddPin" />
                <TypeSelect v-model="quickAddPinForm.type" :options="pinTypeOptions" input-class="w-full" />
                <MentionTextarea v-model="quickAddPinForm.description" placeholder="Description (optional)" :rows="2" />
                <label class="flex items-center gap-1.5 text-xs text-zinc-500">
                  <input v-model="quickAddPinForm.isPrivate" type="checkbox" class="accent-purple-500" />
                  🔒 Private (only you & admins)
                </label>
                <div class="flex justify-end gap-2">
                  <button @click="showQuickAdd = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                  <button @click="quickAddPin" :disabled="!quickAddPinForm.name.trim()" class="btn text-sm">Add Pin</button>
                </div>
              </template>
            </div>
          </div>
        </transition>
      </Teleport>

      <!-- Sub-Locations Section -->
      <div v-if="subLocations.length > 0 || auth.isDm || auth.isAdmin" class="mb-8">
        <div class="flex items-center gap-3 mb-3">
          <h2 class="label">Sub-Locations ({{ subLocations.length }})</h2>
          <button v-if="auth.isDm || auth.isAdmin" @click="showAddSubLocation = true" class="btn !text-xs !py-1">
            + Add Location
          </button>
        </div>
        <div v-if="subLocations.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
          <div
            v-for="sub in subLocations" :key="sub.id"
            class="card-flat p-3 hover:border-white/15 transition-all duration-200"
            @mouseenter="highlightedSubLocation = sub.id"
            @mouseleave="highlightedSubLocation = null"
          >
            <RouterLink :to="`/locations/${sub.id}`" class="flex items-center gap-2">
              <img :src="getIconUrl(sub.type)" class="w-6 h-6 object-contain shrink-0" :alt="sub.type" />
              <div class="min-w-0">
                <span class="text-xs font-semibold text-zinc-200 truncate block" style="font-family: Manrope, sans-serif">{{ sub.name }}</span>
                <span class="text-[0.6rem] text-zinc-600">{{ sub.type }}
                  <span v-if="sub.mapPosition" class="text-green-400/50 ml-0.5">📍</span>
                </span>
              </div>
            </RouterLink>
            <div v-if="(auth.isDm || auth.isAdmin) && location!.mapImageUrl" class="flex gap-1 mt-1.5">
              <button v-if="!sub.mapPosition" @click="placingSubLocation = sub.id" class="text-zinc-600 hover:text-zinc-300 text-[0.6rem] transition-colors">📍 Place</button>
              <button v-if="sub.mapPosition" @click="removeSubLocationFromMap(sub)" class="text-zinc-600 hover:text-zinc-400 text-[0.6rem] transition-colors" title="Remove from map">📍✕</button>
            </div>
          </div>
        </div>
        <!-- Add Sub-Location form is now a modal (see Teleport below) -->
      </div>

      <!-- Location Markers Section -->
      <div v-if="locationMarkers.length > 0" class="mb-8">
        <h2 class="label mb-3">Markers ({{ locationMarkers.length }})</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          <div v-for="marker in locationMarkers" :key="marker.id" class="card-flat p-3 flex items-center gap-2">
            <img :src="getIconUrl(marker.type || 'other')" class="w-5 h-5 object-contain shrink-0" />
            <div class="min-w-0">
              <span class="text-xs font-semibold text-zinc-200 truncate block" style="font-family: Manrope, sans-serif">{{ marker.name }}</span>
              <span class="text-[0.6rem] text-zinc-600">{{ marker.type }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Features Section -->
      <div>
        <div class="flex items-center gap-3 mb-3">
          <h2 class="label">Features & Points of Interest ({{ visibleFeatures.length }})</h2>
          <button v-if="auth.isAuthenticated && !auth.isGuest" @click="showAddFeature = true" class="btn !text-xs !py-1">
            + Add Feature
          </button>
        </div>

        <!-- Add feature form is now a modal (see Teleport below) -->

        <div v-if="visibleFeatures.length === 0" class="text-zinc-600 text-sm">No features discovered yet.</div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
          <div
            v-for="feat in visibleFeatures" :key="feat.id"
            :id="'feat-' + feat.id"
            :class="['card-flat p-3 cursor-pointer transition-all duration-200 relative overflow-hidden', highlightedFeature === feat.id ? 'border-[#ef233c]/40 bg-[#ef233c]/5' : 'hover:border-white/15', feat.hidden ? '!border-amber-500/40 !border-dashed !border-2' : '']"
            @mouseenter="highlightedFeature = feat.id"
            @mouseleave="highlightedFeature = null"
          >
            <div>
              <!-- Hidden banner -->
              <div v-if="feat.hidden" class="absolute top-0 left-0 right-0 bg-amber-500/20 text-amber-400 text-[0.5rem] font-bold uppercase tracking-widest text-center py-0.5 z-10" style="font-family: Manrope, sans-serif">🚫 Hidden</div>
              <div :class="feat.hidden ? 'mt-3' : ''">
                <div class="flex items-center gap-1.5 mb-1">
                  <img :src="getIconUrl(feat.type)" class="w-5 h-5 object-contain shrink-0" :alt="feat.type" />
                  <span class="text-xs font-semibold text-zinc-200 truncate" style="font-family: Manrope, sans-serif">{{ feat.name }}</span>
                </div>
                <div class="flex items-center gap-1 mb-1">
                  <span class="text-[0.6rem] text-zinc-600">{{ feat.type }}</span>
                  <span v-if="feat.mapPosition" class="text-[0.55rem] text-green-400/50">📍</span>
                  <span v-if="feat.hexKey || location!.hexKey" class="text-[0.55rem] text-zinc-600 cursor-default" @mouseenter="showMiniMap((feat.hexKey || location!.hexKey)!, $event)" @mouseleave="hideMiniMap" @click.stop="toggleMiniMap((feat.hexKey || location!.hexKey)!, $event)">🗺️ {{ feat.hexKey || location!.hexKey }}</span>
                </div>
                <p v-if="feat.description" class="text-zinc-500 text-[0.65rem] line-clamp-2"><MentionText :text="feat.description" /></p>
                <!-- Action buttons (always visible) -->
                <div class="flex items-center gap-1 mt-1.5">
                  <button v-if="location!.mapImageUrl && !feat.mapPosition" @click.stop="placingFeature = feat.id" class="text-zinc-600 hover:text-zinc-300 text-[0.6rem] transition-colors">📍 Place</button>
                  <button v-if="feat.mapPosition" @click.stop="removeFeatureFromMap(feat)" class="text-zinc-600 hover:text-zinc-400 text-[0.6rem] transition-colors" title="Remove from map">📍✕</button>
                  <span class="flex-1"></span>
                  <button v-if="auth.isDm || auth.isAdmin" @click.stop="toggleFeatureHidden(feat)" :class="['text-sm transition-colors', feat.hidden ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-amber-400']" :title="feat.hidden ? 'Show to players' : 'Hide from players'">{{ feat.hidden ? '🚫' : '👁️' }}</button>
                  <button v-if="auth.isAuthenticated && !auth.isGuest" @click.stop="startEditFeature(feat)" class="text-zinc-600 hover:text-zinc-300 text-sm transition-colors">✏️</button>
                  <button v-if="auth.isDm || auth.isAdmin" @click.stop="deleteFeature(feat)" class="text-zinc-600 hover:text-red-400 text-sm transition-colors">🗑️</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline Entries Section -->
      <div class="mt-8 border-t border-white/[0.06] pt-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-4" style="font-family: Manrope, sans-serif">⏳ Timeline</h2>

        <div v-if="loadingTimeline" class="text-zinc-500 text-sm animate-pulse">Loading timeline...</div>
        <div v-else-if="entriesBySession.length === 0" class="text-zinc-600 text-sm">No session entries linked to this location yet.</div>

        <div v-else class="space-y-6">
          <div v-for="[sessionId, sessionEntries] in entriesBySession" :key="sessionId">
            <div class="flex items-center gap-2 mb-2">
              <RouterLink :to="`/sessions/${sessionId}`" class="text-sm font-semibold text-zinc-200 hover:text-[#ef233c] transition-colors" style="font-family: Manrope, sans-serif">
                {{ timelineSessions.get(sessionId)?.title || 'Unknown Session' }}
              </RouterLink>
              <span v-if="timelineSessions.get(sessionId)?.sessionNumber" class="text-xs text-zinc-600">#{{ timelineSessions.get(sessionId)!.sessionNumber }}</span>
              <span class="text-xs text-zinc-600">{{ formatSessionDate(timelineSessions.get(sessionId)?.date) }}</span>
            </div>
            <div class="space-y-2 pl-3 border-l-2 border-white/[0.06]">
              <div v-for="entry in sessionEntries" :key="entry.id" class="card-flat p-3">
                <div class="flex items-start gap-3">
                  <div v-if="entry.imageUrl" class="shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                    <img :src="entry.imageUrl" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span :class="['text-[0.65rem] px-1.5 py-0.5 rounded font-semibold leading-none', entryTypeConfig[entry.type]?.color || 'bg-zinc-500/15 text-zinc-400']">
                        {{ entryTypeConfig[entry.type]?.icon }} {{ entryTypeConfig[entry.type]?.label }}
                      </span>
                      <h3 class="text-sm font-semibold text-zinc-200 truncate" style="font-family: Manrope, sans-serif">{{ entry.title }}</h3>
                    </div>
                    <p v-if="entry.description" class="text-xs text-zinc-500 line-clamp-2"><MentionText :text="entry.description" /></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Feature Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="editingFeature" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="editingFeature = null" />
          <div class="relative bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-[#ef233c]" style="font-family: Manrope, sans-serif">✏️ Edit Feature</h2>
              <button @click="editingFeature = null" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="label text-xs block mb-1">Name</label>
                <input v-model="editFeatForm.name" class="input w-full" placeholder="Name" />
              </div>
              <div>
                <label class="label text-xs block mb-1">Type</label>
                <TypeSelect v-model="editFeatForm.type" :options="featureTypeOptions" input-class="w-full" />
              </div>
              <div>
                <label class="label text-xs block mb-1">Description</label>
                <MentionTextarea v-model="editFeatForm.description" :rows="3" placeholder="Description..." />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
              <button @click="editingFeature = null" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEditFeature" :disabled="!editFeatForm.name.trim() || savingFeature" class="btn text-sm inline-flex items-center gap-1.5">
                <svg v-if="savingFeature" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {{ savingFeature ? 'Saving...' : '💾 Save' }}
              </button>
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
          <HexMiniMap :hexKey="miniMapHex" :width="320" />
        </div>
      </transition>
    </Teleport>
    <!-- Add Sub-Location Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showAddSubLocation" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showAddSubLocation = false" />
          <div class="relative bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-[#ef233c]" style="font-family: Manrope, sans-serif">📍 Add Sub-Location</h2>
              <button @click="showAddSubLocation = false" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-sm font-semibold text-zinc-400">Name</label>
                <input v-model="newSubLoc.name" placeholder="Location name" class="input w-full" @keyup.enter="addSubLocation" />
              </div>
              <div>
                <label class="text-sm font-semibold text-zinc-400">Type</label>
                <TypeSelect v-model="newSubLoc.type" :options="locationTypeOptions" input-class="w-full" />
              </div>
              <div>
                <label class="text-sm font-semibold text-zinc-400">Description</label>
                <MentionTextarea v-model="newSubLoc.description" :rows="2" placeholder="Description (optional)" />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
              <button @click="showAddSubLocation = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="addSubLocation" :disabled="!newSubLoc.name.trim()" class="btn text-sm">Create</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Add Feature Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showAddFeature" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showAddFeature = false" />
          <div class="relative bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-[#ef233c]" style="font-family: Manrope, sans-serif">📌 Add Feature</h2>
              <button @click="showAddFeature = false" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-sm font-semibold text-zinc-400">Name</label>
                <input v-model="newFeat.name" placeholder="Feature name" class="input w-full" />
              </div>
              <div>
                <label class="text-sm font-semibold text-zinc-400">Type</label>
                <TypeSelect v-model="newFeat.type" :options="featureTypeOptions" input-class="w-full" />
              </div>
              <div>
                <label class="text-sm font-semibold text-zinc-400">Description</label>
                <MentionTextarea v-model="newFeat.description" placeholder="Description..." :rows="2" />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
              <button @click="showAddFeature = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="addFeature" :disabled="!newFeat.name.trim()" class="btn text-sm">Add</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

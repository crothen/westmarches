<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import LocationMapViewer from '../components/map/LocationMapViewer.vue'
import type { CampaignLocation, LocationFeature } from '../types'

const route = useRoute()
const auth = useAuthStore()
const { generating, error: genError, generateImage } = useImageGen()

const location = ref<CampaignLocation | null>(null)
const features = ref<LocationFeature[]>([])
const loading = ref(true)
const showAddFeature = ref(false)
const uploadingMap = ref(false)
const uploadProgress = ref(0)
const placingFeature = ref<string | null>(null)

// Quick-add from map click
const showQuickAdd = ref(false)
const quickAddPos = ref({ x: 0, y: 0 })
const quickAddForm = ref({ name: '', type: 'other' as any, description: '' })

const newFeat = ref({ name: '', type: 'other' as any, description: '' })

const featureTypes = ['inn', 'shop', 'temple', 'shrine', 'blacksmith', 'tavern', 'guild', 'market', 'gate', 'tower', 'ruins', 'cave', 'bridge', 'well', 'monument', 'graveyard', 'dock', 'warehouse', 'barracks', 'library', 'other']

const typeIcons: Record<string, string> = {
  inn: '🍺', shop: '🛒', temple: '⛪', shrine: '🕯️', blacksmith: '⚒️', tavern: '🍻', guild: '🏛️',
  market: '🛍️', gate: '🚪', tower: '🗼', ruins: '🏚️', cave: '🕳️', bridge: '🌉',
  well: '💧', monument: '🗿', graveyard: '⚰️', dock: '⚓', warehouse: '📦',
  barracks: '⚔️', library: '📚', other: '📌'
}

const locTypeIcons: Record<string, string> = {
  city: '🏙️', town: '🏘️', village: '🏡', castle: '🏰', fortress: '⛩️',
  monastery: '⛪', camp: '⛺', ruins: '🏚️', other: '📍'
}

onMounted(async () => {
  try {
    const locSnap = await getDoc(doc(db, 'locations', route.params.id as string))
    if (locSnap.exists()) {
      location.value = { id: locSnap.id, ...locSnap.data() } as CampaignLocation
    }
    const featSnap = await getDocs(query(collection(db, 'features'), where('locationId', '==', route.params.id)))
    features.value = featSnap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
  } catch (e) {
    console.error('Failed to load:', e)
  } finally {
    loading.value = false
  }
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

function onMapClick(x: number, y: number) {
  // Only show quick-add if not placing an existing feature
  if (placingFeature.value) return
  quickAddPos.value = { x, y }
  quickAddForm.value = { name: '', type: 'other', description: '' }
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

function onClickFeature(feat: LocationFeature) {
  // Could navigate to feature detail in the future; for now scroll to it in the list
  const el = document.getElementById('feat-' + feat.id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

async function generateLocationImage() {
  if (!location.value) return
  const prompt = `Create a fantasy illustration of a ${location.value.type} called "${location.value.name}" in a D&D medieval fantasy setting. ${location.value.description}. Style: detailed fantasy landscape art, dramatic lighting, painterly style.`
  const url = await generateImage(prompt, `location-images/${location.value.id}`)
  if (url) {
    await updateDoc(doc(db, 'locations', location.value.id), { imageUrl: url })
    location.value.imageUrl = url
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
        <span class="text-2xl">{{ locTypeIcons[location.type] || '📍' }}</span>
        <h1 class="text-3xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">{{ location.name }}</h1>
        <span class="badge bg-white/5 text-zinc-500">{{ location.type }}</span>
      </div>
      <p v-if="location.hexKey" class="text-zinc-600 text-sm mb-4">📍 Hex {{ location.hexKey }}</p>
      <p class="text-zinc-400 mb-6">{{ location.description }}</p>

      <!-- Location Image -->
      <div v-if="location.imageUrl" class="mb-6">
        <img :src="location.imageUrl" class="w-full max-h-64 object-cover rounded-xl border border-white/10" />
      </div>
      <button v-if="!location.imageUrl && auth.isAuthenticated" @click="generateLocationImage" :disabled="generating" class="btn !text-xs !py-1.5 mb-6">
        {{ generating ? '🎨 Generating...' : '🎨 Generate Image' }}
      </button>
      <div v-if="genError" class="text-red-400 text-xs mb-4">{{ genError }}</div>

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
            :placingFeature="placingFeature"
            :isInteractive="true"
            @place="onPlaceFeature"
            @click-feature="onClickFeature"
            @map-click="onMapClick"
          />
          <p class="text-zinc-600 text-[0.6rem] mt-1.5">Scroll to zoom · Drag to pan · Click map to add a POI</p>
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

      <!-- Quick Add POI Modal -->
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
                <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">📌 Add Point of Interest</h3>
                <button @click="showQuickAdd = false" class="text-zinc-500 hover:text-white transition-colors">✕</button>
              </div>
              <input v-model="quickAddForm.name" placeholder="Name" class="input w-full" @keyup.enter="quickAddFeature" />
              <select v-model="quickAddForm.type" class="input w-full">
                <option v-for="t in featureTypes" :key="t" :value="t">{{ typeIcons[t] || '' }} {{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
              </select>
              <textarea v-model="quickAddForm.description" placeholder="Description (optional)" class="input w-full" rows="2" />
              <div class="flex justify-end gap-2">
                <button @click="showQuickAdd = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                <button @click="quickAddFeature" :disabled="!quickAddForm.name.trim()" class="btn text-sm">Add & Place</button>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>

      <!-- Features Section -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="label">Features & Points of Interest ({{ features.length }})</h2>
          <button v-if="auth.isAuthenticated" @click="showAddFeature = !showAddFeature" class="btn !text-xs !py-1">
            {{ showAddFeature ? 'Cancel' : '+ Add Feature' }}
          </button>
        </div>

        <!-- Add feature form -->
        <div v-if="showAddFeature" class="card-flat p-4 mb-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input v-model="newFeat.name" placeholder="Feature name" class="input" />
            <select v-model="newFeat.type" class="input">
              <option v-for="t in featureTypes" :key="t" :value="t">{{ typeIcons[t] || '' }} {{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
            </select>
            <button @click="addFeature" :disabled="!newFeat.name.trim()" class="btn !py-2">Add</button>
          </div>
          <textarea v-model="newFeat.description" placeholder="Description..." class="input w-full mt-2" rows="2" />
        </div>

        <div v-if="features.length === 0" class="text-zinc-600 text-sm">No features discovered yet.</div>

        <div class="space-y-2">
          <div
            v-for="feat in features" :key="feat.id"
            :id="'feat-' + feat.id"
            class="card-flat p-4 flex items-start justify-between"
          >
            <div class="flex items-start gap-3">
              <span class="text-lg mt-0.5">{{ typeIcons[feat.type] || '📌' }}</span>
              <div>
                <h4 class="text-sm font-semibold text-zinc-200" style="font-family: Manrope, sans-serif">{{ feat.name }}</h4>
                <span class="badge bg-white/5 text-zinc-600 mr-1">{{ feat.type }}</span>
                <span v-if="feat.mapPosition" class="text-[0.6rem] text-green-400/60">📍 placed on map</span>
                <p v-if="feat.description" class="text-sm text-zinc-500 mt-1">{{ feat.description }}</p>
              </div>
            </div>
            <button
              v-if="location.mapImageUrl && !feat.mapPosition"
              @click="placingFeature = feat.id"
              class="btn-ghost !text-[0.6rem] !py-1 !px-2 shrink-0"
            >📍 Place on Map</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

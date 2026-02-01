<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import type { CampaignLocation, LocationFeature } from '../types'

const route = useRoute()
const auth = useAuthStore()
const { generating, generateImage } = useImageGen()

const location = ref<CampaignLocation | null>(null)
const features = ref<LocationFeature[]>([])
const loading = ref(true)
const showAddFeature = ref(false)
const uploadingMap = ref(false)
const uploadProgress = ref(0)
const placingFeature = ref<string | null>(null)

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

const placedFeatures = computed(() => features.value.filter(f => f.mapPosition))

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

function onMapClick(event: MouseEvent) {
  if (!placingFeature.value) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100
  
  placeFeatureOnMap(placingFeature.value, x, y)
}

async function placeFeatureOnMap(featureId: string, x: number, y: number) {
  await updateDoc(doc(db, 'features', featureId), { mapPosition: { x, y } })
  const idx = features.value.findIndex(f => f.id === featureId)
  if (idx >= 0) {
    const existing = features.value[idx]
    features.value[idx] = { ...existing, mapPosition: { x, y } } as LocationFeature
  }
  placingFeature.value = null
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

      <!-- Map Section -->
      <div class="mb-8">
        <h2 class="label mb-3">Location Map</h2>
        
        <div v-if="location.mapImageUrl" class="relative">
          <div
            :class="['relative rounded-xl overflow-hidden border border-white/10', placingFeature ? 'cursor-crosshair' : '']"
            @click="onMapClick"
          >
            <img :src="location.mapImageUrl" class="w-full" />
            
            <!-- Feature markers -->
            <div
              v-for="feat in placedFeatures" :key="feat.id"
              class="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center text-sm cursor-pointer hover:scale-125 transition-transform"
              :style="{ left: feat.mapPosition!.x + '%', top: feat.mapPosition!.y + '%' }"
              :title="feat.name"
            >
              <span class="drop-shadow-lg">{{ typeIcons[feat.type] || '📌' }}</span>
            </div>
          </div>
          
          <div v-if="placingFeature" class="mt-2 text-xs text-[#ef233c] animate-pulse">
            Click on the map to place the feature...
            <button @click="placingFeature = null" class="text-zinc-500 ml-2 hover:text-white">Cancel</button>
          </div>
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
          <div v-for="feat in features" :key="feat.id" class="card-flat p-4 flex items-start justify-between">
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

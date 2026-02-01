<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, addDoc, query, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { CampaignLocation, LocationFeature } from '../types'

const auth = useAuthStore()
const tab = ref<'locations' | 'features'>('locations')
const locations = ref<CampaignLocation[]>([])
const features = ref<LocationFeature[]>([])
const loading = ref(true)
const searchQuery = ref('')
const showAddForm = ref(false)

// Add location form
const newLoc = ref({ name: '', type: 'city' as any, description: '', hexKey: '' })

// Add feature form  
const newFeat = ref({ name: '', type: 'other' as any, description: '', locationId: '', hexKey: '' })

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

const locationTypes = ['city', 'town', 'village', 'castle', 'fortress', 'monastery', 'camp', 'ruins', 'other']
const featureTypes = ['inn', 'shop', 'temple', 'shrine', 'blacksmith', 'tavern', 'guild', 'market', 'gate', 'tower', 'ruins', 'cave', 'bridge', 'well', 'monument', 'graveyard', 'dock', 'warehouse', 'barracks', 'library', 'other']

const filteredLocations = computed(() => {
  if (!searchQuery.value) return locations.value
  const q = searchQuery.value.toLowerCase()
  return locations.value.filter(l => l.name.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
})

const filteredFeatures = computed(() => {
  if (!searchQuery.value) return features.value
  const q = searchQuery.value.toLowerCase()
  return features.value.filter(f => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
})

function getFeatureCount(locId: string): number {
  return features.value.filter(f => f.locationId === locId).length
}

function getLocationName(locId: string): string {
  return locations.value.find(l => l.id === locId)?.name || 'Unknown'
}

const typeIcons: Record<string, string> = {
  city: '🏙️', town: '🏘️', village: '🏡', castle: '🏰', fortress: '⛩️',
  monastery: '⛪', camp: '⛺', ruins: '🏚️', inn: '🍺', shop: '🛒',
  temple: '⛪', shrine: '🕯️', blacksmith: '⚒️', tavern: '🍻', guild: '🏛️',
  market: '🛍️', gate: '🚪', tower: '🗼', cave: '🕳️', bridge: '🌉',
  well: '💧', monument: '🗿', graveyard: '⚰️', dock: '⚓', warehouse: '📦',
  barracks: '⚔️', library: '📚', other: '📌'
}

async function addLocation() {
  if (!newLoc.value.name.trim()) return
  const docRef = await addDoc(collection(db, 'locations'), {
    name: newLoc.value.name.trim(),
    type: newLoc.value.type,
    description: newLoc.value.description.trim(),
    hexKey: newLoc.value.hexKey.trim() || null,
    tags: [],
    discoveredBy: auth.firebaseUser?.uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  locations.value.push({ id: docRef.id, ...newLoc.value, tags: [], createdAt: new Date(), updatedAt: new Date() } as any)
  newLoc.value = { name: '', type: 'city', description: '', hexKey: '' }
  showAddForm.value = false
}

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
  newFeat.value = { name: '', type: 'other', description: '', locationId: '', hexKey: '' }
  showAddForm.value = false
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📍 Locations</h1>
      <button @click="showAddForm = !showAddForm" class="btn !text-xs !py-1.5">
        {{ showAddForm ? 'Cancel' : '+ Add' }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-5 border-b border-white/[0.06] pb-px">
      <button @click="tab = 'locations'" :class="['px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px', tab === 'locations' ? 'text-[#ef233c] border-[#ef233c]' : 'text-zinc-500 border-transparent hover:text-zinc-300']" style="font-family: Manrope, sans-serif">
        🏰 Locations <span class="text-zinc-600 ml-1">({{ locations.length }})</span>
      </button>
      <button @click="tab = 'features'" :class="['px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px', tab === 'features' ? 'text-[#ef233c] border-[#ef233c]' : 'text-zinc-500 border-transparent hover:text-zinc-300']" style="font-family: Manrope, sans-serif">
        📌 Points of Interest <span class="text-zinc-600 ml-1">({{ features.length }})</span>
      </button>
    </div>

    <!-- Add Form -->
    <div v-if="showAddForm" class="card p-5 mb-5 relative z-10">
      <div class="relative z-10">
        <h3 class="label mb-3">{{ tab === 'locations' ? 'Add Location' : 'Add Point of Interest' }}</h3>
        
        <!-- Location form -->
        <div v-if="tab === 'locations'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input v-model="newLoc.name" placeholder="Name" class="input" />
          <select v-model="newLoc.type" class="input">
            <option v-for="t in locationTypes" :key="t" :value="t">{{ typeIcons[t] || '' }} {{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
          </select>
          <input v-model="newLoc.hexKey" placeholder="Hex (e.g. 25_30)" class="input" />
          <div></div>
          <textarea v-model="newLoc.description" placeholder="Description..." class="input md:col-span-2" rows="2" />
          <button @click="addLocation" :disabled="!newLoc.name.trim()" class="btn !py-2">Add Location</button>
        </div>

        <!-- Feature form -->
        <div v-if="tab === 'features'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input v-model="newFeat.name" placeholder="Name" class="input" />
          <select v-model="newFeat.type" class="input">
            <option v-for="t in featureTypes" :key="t" :value="t">{{ typeIcons[t] || '' }} {{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
          </select>
          <select v-model="newFeat.locationId" class="input">
            <option value="">No parent location (standalone)</option>
            <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
          </select>
          <input v-model="newFeat.hexKey" placeholder="Hex (e.g. 25_30) — for standalone" class="input" />
          <textarea v-model="newFeat.description" placeholder="Description..." class="input md:col-span-2" rows="2" />
          <button @click="addFeature" :disabled="!newFeat.name.trim()" class="btn !py-2">Add Feature</button>
        </div>
      </div>
    </div>

    <!-- Search -->
    <input v-model="searchQuery" type="text" placeholder="Search..." class="input w-full max-w-md mb-5" />

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <!-- Locations Tab -->
    <div v-else-if="tab === 'locations'">
      <div v-if="filteredLocations.length === 0" class="card p-10 text-center relative z-10"><div class="relative z-10 text-zinc-600">No locations discovered yet.</div></div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <RouterLink
          v-for="loc in filteredLocations" :key="loc.id"
          :to="`/locations/${loc.id}`"
          class="card relative z-10 group cursor-pointer"
        >
          <div class="relative z-10">
            <img v-if="loc.mapImageUrl || loc.imageUrl" :src="loc.mapImageUrl || loc.imageUrl" class="w-full h-36 object-cover rounded-t-xl -mt-px -mx-px" style="width: calc(100% + 2px)" />
            <div class="p-5">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-lg">{{ typeIcons[loc.type] || '📍' }}</span>
                <h3 class="text-base font-semibold text-white group-hover:text-[#ef233c] transition-colors" style="font-family: Manrope, sans-serif">{{ loc.name }}</h3>
              </div>
              <div class="flex items-center gap-2 mb-2">
                <span class="badge bg-white/5 text-zinc-500">{{ loc.type }}</span>
                <span v-if="loc.hexKey" class="text-xs text-zinc-600">📍 Hex {{ loc.hexKey }}</span>
                <span v-if="getFeatureCount(loc.id)" class="text-xs text-zinc-600">· {{ getFeatureCount(loc.id) }} features</span>
              </div>
              <p class="text-sm text-zinc-500 line-clamp-2">{{ loc.description }}</p>
            </div>
          </div>
        </RouterLink>
      </div>
    </div>

    <!-- Features Tab -->
    <div v-else-if="tab === 'features'">
      <div v-if="filteredFeatures.length === 0" class="card p-10 text-center relative z-10"><div class="relative z-10 text-zinc-600">No points of interest discovered yet.</div></div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div v-for="feat in filteredFeatures" :key="feat.id" class="card relative z-10">
          <div class="relative z-10 p-5">
            <div class="flex items-center gap-2 mb-1">
              <span>{{ typeIcons[feat.type] || '📌' }}</span>
              <h3 class="text-base font-semibold text-white" style="font-family: Manrope, sans-serif">{{ feat.name }}</h3>
            </div>
            <div class="flex items-center gap-2 mb-2">
              <span class="badge bg-white/5 text-zinc-500">{{ feat.type }}</span>
              <span v-if="feat.locationId" class="text-xs text-zinc-600">in {{ getLocationName(feat.locationId) }}</span>
              <span v-if="feat.hexKey" class="text-xs text-zinc-600">📍 Hex {{ feat.hexKey }}</span>
            </div>
            <p class="text-sm text-zinc-500">{{ feat.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

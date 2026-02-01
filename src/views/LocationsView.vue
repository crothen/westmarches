<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, addDoc, query, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { CampaignLocation, LocationFeature } from '../types'

const auth = useAuthStore()
const locations = ref<CampaignLocation[]>([])
const features = ref<LocationFeature[]>([])
const loading = ref(true)
const searchQuery = ref('')
const showAddForm = ref(false)
const newLoc = ref({ name: '', type: 'city' as any, description: '', hexKey: '' })

const locationTypes = ['city', 'town', 'village', 'castle', 'fortress', 'monastery', 'camp', 'ruins', 'other']
const typeIcons: Record<string, string> = {
  city: '🏙️', town: '🏘️', village: '🏡', castle: '🏰', fortress: '⛩️',
  monastery: '⛪', camp: '⛺', ruins: '🏚️', other: '📍'
}

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

const filteredLocations = computed(() => {
  if (!searchQuery.value) return locations.value
  const q = searchQuery.value.toLowerCase()
  return locations.value.filter(l => l.name.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
})

function getFeatureCount(locId: string): number {
  return features.value.filter(f => f.locationId === locId).length
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
  locations.value.sort((a, b) => a.name.localeCompare(b.name))
  newLoc.value = { name: '', type: 'city', description: '', hexKey: '' }
  showAddForm.value = false
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
          <select v-model="newLoc.type" class="input">
            <option v-for="t in locationTypes" :key="t" :value="t">{{ typeIcons[t] || '' }} {{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
          </select>
          <input v-model="newLoc.hexKey" placeholder="Hex (e.g. 25_30)" class="input" />
          <div></div>
          <textarea v-model="newLoc.description" placeholder="Description..." class="input md:col-span-2" rows="2" />
          <button @click="addLocation" :disabled="!newLoc.name.trim()" class="btn !py-2">Add Location</button>
        </div>
      </div>
    </div>

    <input v-model="searchQuery" type="text" placeholder="Search locations..." class="input w-full max-w-md mb-5" />

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="filteredLocations.length === 0" class="card p-10 text-center relative z-10">
      <div class="relative z-10 text-zinc-600">No locations discovered yet.</div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
</template>

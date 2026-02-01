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

const newFeat = ref({ name: '', type: 'other' as any, description: '', locationId: '', hexKey: '' })

const featureTypes = ['inn', 'shop', 'temple', 'shrine', 'blacksmith', 'tavern', 'guild', 'market', 'gate', 'tower', 'ruins', 'cave', 'bridge', 'well', 'monument', 'graveyard', 'dock', 'warehouse', 'barracks', 'library', 'other']

const typeIcons: Record<string, string> = {
  inn: '🍺', shop: '🛒', temple: '⛪', shrine: '🕯️', blacksmith: '⚒️',
  tavern: '🍻', guild: '🏛️', market: '🛍️', gate: '🚪', tower: '🗼',
  ruins: '🏚️', cave: '🕳️', bridge: '🌉', well: '💧', monument: '🗿',
  graveyard: '⚰️', dock: '⚓', warehouse: '📦', barracks: '⚔️', library: '📚', other: '📌'
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

const filteredFeatures = computed(() => {
  if (!searchQuery.value) return features.value
  const q = searchQuery.value.toLowerCase()
  return features.value.filter(f => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
})

function getLocationName(locId: string): string {
  return locations.value.find(l => l.id === locId)?.name || 'Unknown'
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
  features.value.sort((a, b) => a.name.localeCompare(b.name))
  newFeat.value = { name: '', type: 'other', description: '', locationId: '', hexKey: '' }
  showAddForm.value = false
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

    <input v-model="searchQuery" type="text" placeholder="Search POIs..." class="input w-full max-w-md mb-5" />

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="filteredFeatures.length === 0" class="card p-10 text-center relative z-10">
      <div class="relative z-10 text-zinc-600">No points of interest discovered yet.</div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <div v-for="feat in filteredFeatures" :key="feat.id" class="card relative z-10">
        <div class="relative z-10 p-5">
          <div class="flex items-center gap-2 mb-1">
            <span>{{ typeIcons[feat.type] || '📌' }}</span>
            <h3 class="text-base font-semibold text-white" style="font-family: Manrope, sans-serif">{{ feat.name }}</h3>
          </div>
          <div class="flex items-center gap-2 mb-2">
            <span class="badge bg-white/5 text-zinc-500">{{ feat.type }}</span>
            <RouterLink v-if="feat.locationId" :to="`/locations/${feat.locationId}`" class="text-xs text-zinc-500 hover:text-[#ef233c] transition-colors">
              in {{ getLocationName(feat.locationId) }}
            </RouterLink>
            <span v-if="feat.hexKey" class="text-xs text-zinc-600">📍 Hex {{ feat.hexKey }}</span>
          </div>
          <p class="text-sm text-zinc-500">{{ feat.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

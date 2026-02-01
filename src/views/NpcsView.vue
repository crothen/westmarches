<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import type { Npc } from '../types'

const auth = useAuthStore()
const { error: genError, generateImage } = useImageGen()

const npcs = ref<Npc[]>([])
const loading = ref(true)
const searchQuery = ref('')
const filterTag = ref<string | null>(null)
const expandedNpc = ref<string | null>(null)
const generatingForNpc = ref<string | null>(null)

onMounted(async () => {
  try {
    const snap = await getDocs(query(collection(db, 'npcs'), orderBy('name', 'asc')))
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  } catch (e) {
    console.error('Failed to load NPCs:', e)
  } finally {
    loading.value = false
  }
})

const allTags = computed(() => {
  const tagSet = new Set<string>()
  npcs.value.forEach(n => (n.tags || []).forEach(t => tagSet.add(t)))
  return Array.from(tagSet).sort()
})

const filteredNpcs = computed(() => {
  return npcs.value.filter(n => {
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!n.name.toLowerCase().includes(q) && !n.race?.toLowerCase().includes(q) && !n.description?.toLowerCase().includes(q)) return false
    }
    if (filterTag.value && !(n.tags || []).includes(filterTag.value)) return false
    return true
  })
})

const isDeceased = (npc: Npc) => (npc.tags || []).includes('deceased')
// isLeader check is handled by getRoleBadge

function toggleExpand(id: string) {
  expandedNpc.value = expandedNpc.value === id ? null : id
}

function getUnitAbbrev(npc: Npc): string | null {
  const unitTags = ['ZFC', 'LDU', 'DDU', 'GDU', 'PCU', 'EFDU', 'UEU', 'VIU']
  const found = (npc.tags || []).find(t => unitTags.includes(t))
  return found || null
}

function getRoleBadge(npc: Npc): string | null {
  if ((npc.tags || []).includes('commander')) return 'Commander'
  if ((npc.tags || []).includes('leader')) return 'Leader'
  if ((npc.tags || []).includes('subleader')) return 'Vice-Leader'
  return null
}

async function generatePortrait(npc: Npc) {
  generatingForNpc.value = npc.id
  const prompt = `Create a fantasy character portrait for a D&D RPG character. The character is ${npc.name}, a ${npc.race}. ${npc.description}. Style: detailed fantasy art portrait, medieval setting, dramatic lighting, painterly style. Head and shoulders portrait only.`

  const url = await generateImage(prompt, `npc-portraits/${npc.id}`)
  if (url) {
    await updateDoc(doc(db, 'npcs', npc.id), { imageUrl: url })
    const idx = npcs.value.findIndex(n => n.id === npc.id)
    if (idx >= 0) npcs.value[idx]!.imageUrl = url
  }
  generatingForNpc.value = null
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">👤 Known NPCs</h1>
      <span class="text-zinc-600 text-sm">{{ filteredNpcs.length }} contacts</span>
    </div>

    <!-- Search and filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <input v-model="searchQuery" type="text" placeholder="Search by name, race, or description..." class="input flex-1 min-w-[200px]" />
      <select v-model="filterTag" class="input">
        <option :value="null">All Tags</option>
        <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading NPCs...</div>

    <div v-else-if="filteredNpcs.length === 0" class="card p-10 text-center relative z-10">
      <div class="relative z-10">
        <p class="text-zinc-600">No NPCs found.</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <div
        v-for="npc in filteredNpcs" :key="npc.id"
        :class="['card relative z-10 cursor-pointer', isDeceased(npc) ? 'opacity-50' : '']"
        @click="toggleExpand(npc.id)"
      >
        <div class="relative z-10">
          <!-- Portrait -->
          <div v-if="npc.imageUrl" class="overflow-hidden">
            <img :src="npc.imageUrl" class="w-full h-40 object-cover rounded-t-xl" />
          </div>
          <div class="p-5">
          <!-- Header -->
          <div class="flex items-start justify-between mb-2">
            <div>
              <h3 :class="['text-base font-semibold', isDeceased(npc) ? 'line-through text-zinc-500' : 'text-white']" style="font-family: Manrope, sans-serif">
                {{ npc.name }}
              </h3>
              <span class="text-zinc-500 text-sm">{{ npc.race }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span v-if="getRoleBadge(npc)" class="badge bg-[#ef233c]/15 text-[#ef233c]">{{ getRoleBadge(npc) }}</span>
              <span v-if="getUnitAbbrev(npc)" class="badge bg-white/5 text-zinc-400">{{ getUnitAbbrev(npc) }}</span>
              <span v-if="isDeceased(npc)" class="badge bg-zinc-800 text-zinc-500">☠️ Dead</span>
            </div>
          </div>

          <!-- Description preview -->
          <p :class="['text-sm mt-2', expandedNpc === npc.id ? 'text-zinc-300' : 'text-zinc-500 line-clamp-2']">
            {{ npc.description }}
          </p>

          <!-- Expanded details -->
          <div v-if="expandedNpc === npc.id" class="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
            <div v-if="npc.locationEncountered" class="text-sm">
              <span class="text-zinc-600">📍 Encountered at:</span>
              <span class="text-zinc-400 ml-1">{{ npc.locationEncountered }}</span>
            </div>
            <div v-if="npc.tags?.length" class="flex flex-wrap gap-1.5 mt-2">
              <span v-for="tag in npc.tags" :key="tag" class="text-[0.65rem] px-2 py-0.5 rounded-full bg-white/5 text-zinc-500">{{ tag }}</span>
            </div>
          </div>

          <!-- Generate Portrait button -->
          <button
            v-if="auth.isAuthenticated && expandedNpc === npc.id"
            @click.stop="generatePortrait(npc)"
            :disabled="generatingForNpc === npc.id"
            class="btn !text-[0.65rem] !py-1.5 !px-3 mt-2"
          >
            {{ generatingForNpc === npc.id ? '🎨 Generating...' : '🎨 Generate Portrait' }}
          </button>
          <div v-if="genError && generatingForNpc === npc.id" class="text-red-400 text-xs mt-1">{{ genError }}</div>

          <!-- Tags row (collapsed) -->
          <div v-if="expandedNpc !== npc.id && npc.locationEncountered" class="mt-2">
            <span class="text-xs text-zinc-600">📍 {{ npc.locationEncountered }}</span>
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

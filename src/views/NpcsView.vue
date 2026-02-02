<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { collection, query, orderBy, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import type { Npc, NpcNote, Organization } from '../types'
import TagInput from '../components/common/TagInput.vue'

const auth = useAuthStore()
const { error: genError, generateImage } = useImageGen()

const npcs = ref<Npc[]>([])
const orgs = ref<Organization[]>([])
const npcNotes = ref<Record<string, NpcNote[]>>({})
const loading = ref(true)
const searchQuery = ref('')
const filterTag = ref<string | null>(null)
const generatingForNpc = ref<string | null>(null)

// Modal edit state
const showEditModal = ref(false)
const editingNpcData = ref<Npc | null>(null)
const editForm = ref({ name: '', race: '', description: '', locationEncountered: '', tags: [] as string[] })
const savingEdit = ref(false)
const portraitPrompt = ref('')

// Note state (used in edit modal only now)


const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name', 'asc')), async (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
    loading.value = false

    if (window.location.hash) {
      const targetId = window.location.hash.slice(1)
      if (npcs.value.some(n => n.id === targetId)) {
        await nextTick()
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, (e) => {
    console.error('Failed to load NPCs:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    orgs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))
  }, (e) => console.error('Failed to load organizations:', e)))

  if (auth.isAuthenticated) {
    _unsubs.push(onSnapshot(query(collection(db, 'npcNotes'), orderBy('createdAt', 'desc')), (snap) => {
      const newNpcNotes: Record<string, NpcNote[]> = {}
      const allNotes = snap.docs.map(d => ({ id: d.id, ...d.data() } as NpcNote))
      for (const note of allNotes) {
        if (note.isPrivate && note.userId !== auth.firebaseUser?.uid && !auth.isDm && !auth.isAdmin) continue
        if (!newNpcNotes[note.npcId]) newNpcNotes[note.npcId] = []
        newNpcNotes[note.npcId]!.push(note)
      }
      npcNotes.value = newNpcNotes
    }, (e) => console.warn('Failed to load NPC notes:', e)))
  }
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

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

function getUnitAbbrev(npc: Npc): string | null {
  const unitTags = ['ZFC', 'LDU', 'DDU', 'GDU', 'PCU', 'EFDU', 'UEU', 'VIU']
  return (npc.tags || []).find(t => unitTags.includes(t)) || null
}

function getRoleBadge(npc: Npc): string | null {
  if ((npc.tags || []).includes('commander')) return 'Commander'
  if ((npc.tags || []).includes('leader')) return 'Leader'
  if ((npc.tags || []).includes('subleader')) return 'Vice-Leader'
  return null
}

function noteCount(npcId: string): number {
  return npcNotes.value[npcId]?.length || 0
}

function getDefaultPortraitPrompt(npc: Npc): string {
  return `Fantasy character portrait for a D&D RPG. ${npc.name}, a ${npc.race || 'unknown race'}. ${npc.description || ''}. Style: detailed fantasy art, medieval setting, dramatic lighting, painterly. Head and shoulders portrait.`
}

// --- Edit Modal ---
function openEditModal(npc: Npc) {
  editingNpcData.value = npc
  editForm.value = {
    name: npc.name,
    race: npc.race || '',
    description: npc.description || '',
    locationEncountered: npc.locationEncountered || '',
    tags: [...(npc.tags || [])],
  }
  portraitPrompt.value = getDefaultPortraitPrompt(npc)
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingNpcData.value = null
}

async function saveEdit() {
  if (!editingNpcData.value) return
  const npc = editingNpcData.value
  savingEdit.value = true

  const updates: Partial<Npc> = {
    name: editForm.value.name.trim(),
    race: editForm.value.race.trim(),
    description: editForm.value.description.trim(),
    locationEncountered: editForm.value.locationEncountered.trim(),
    tags: editForm.value.tags,
    updatedAt: new Date(),
  }

  try {
    await updateDoc(doc(db, 'npcs', npc.id), updates as any)
    Object.assign(npc, updates)
    closeEditModal()
  } catch (e) {
    console.error('Failed to save NPC:', e)
    alert('Failed to save. Check your permissions.')
  } finally {
    savingEdit.value = false
  }
}

async function generatePortrait() {
  if (!editingNpcData.value) return
  const npc = editingNpcData.value
  generatingForNpc.value = npc.id

  const url = await generateImage(portraitPrompt.value, `npc-portraits/${npc.id}`)
  if (url) {
    await updateDoc(doc(db, 'npcs', npc.id), { imageUrl: url })
    npc.imageUrl = url
    // Also update in the main list
    const idx = npcs.value.findIndex(n => n.id === npc.id)
    if (idx >= 0) npcs.value[idx]!.imageUrl = url
  }
  generatingForNpc.value = null
}

// --- Hover card ---
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
      <div class="relative z-10"><p class="text-zinc-600">No NPCs found.</p></div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <RouterLink
        v-for="npc in filteredNpcs" :key="npc.id"
        :id="npc.id"
        :to="'/npcs/' + npc.id"
        :class="['card relative z-10 cursor-pointer hover:border-white/15 transition-colors block no-underline', isDeceased(npc) ? 'opacity-50' : '']"
      >
        <div class="relative z-10 flex">
          <!-- Full-height portrait on the left -->
          <div v-if="npc.imageUrl" class="shrink-0 w-24 overflow-hidden rounded-l-[inherit]">
            <img :src="npc.imageUrl" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0 p-4">
            <!-- Header -->
            <div class="flex items-start justify-between mb-1">
              <div class="min-w-0">
                <span
                  class="text-base font-semibold"
                  :class="isDeceased(npc) ? 'line-through text-zinc-500' : 'text-white'"
                  style="font-family: Manrope, sans-serif"
                >{{ npc.name }}</span>
                <div class="text-zinc-500 text-sm">{{ npc.race }}</div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="noteCount(npc.id)" class="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500/80" :title="noteCount(npc.id) + ' note(s)'">📝 {{ noteCount(npc.id) }}</span>
                <span v-if="getRoleBadge(npc)" class="badge bg-[#ef233c]/15 text-[#ef233c]">{{ getRoleBadge(npc) }}</span>
                <span v-if="getUnitAbbrev(npc)" class="badge bg-white/5 text-zinc-400">{{ getUnitAbbrev(npc) }}</span>
                <span v-if="isDeceased(npc)" class="badge bg-zinc-800 text-zinc-500">☠️ Dead</span>
                <button
                  v-if="auth.isDm || auth.isAdmin"
                  @click.prevent="openEditModal(npc)"
                  class="text-zinc-600 hover:text-zinc-300 text-sm transition-colors ml-1"
                  title="Edit NPC"
                >✏️</button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <span v-for="tag in (npc.tags || []).filter(t => !['commander','leader','subleader','deceased','ZFC','LDU','DDU','GDU','PCU','EFDU','UEU','VIU'].includes(t)).slice(0, 3)" :key="tag" class="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-600">{{ tag }}</span>
            </div>

            <!-- Description preview -->
            <p class="text-sm mt-2 text-zinc-500 line-clamp-2">{{ npc.description }}</p>

            <!-- Footer -->
            <div class="mt-2 flex items-center gap-2">
              <span v-if="npc.locationEncountered" class="text-xs text-zinc-600">📍 {{ npc.locationEncountered }}</span>
            </div>
          </div><!-- /flex-1 content -->
        </div><!-- /flex row -->
      </RouterLink>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showEditModal && editingNpcData" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="closeEditModal" />
          <div class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit {{ editingNpcData.name }}</h3>
              <button @click="closeEditModal" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <!-- Current portrait -->
            <div v-if="editingNpcData.imageUrl" class="overflow-hidden rounded-xl">
              <img :src="editingNpcData.imageUrl" class="w-full h-48 object-cover" />
            </div>

            <div class="space-y-3">
              <div>
                <label class="label text-xs mb-1 block">Name</label>
                <input v-model="editForm.name" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Race</label>
                <input v-model="editForm.race" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Description</label>
                <textarea v-model="editForm.description" class="input w-full" rows="4" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Location Encountered</label>
                <input v-model="editForm.locationEncountered" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Tags</label>
                <TagInput v-model="editForm.tags" />
              </div>

              <!-- Portrait Generation -->
              <div class="pt-2 border-t border-white/[0.06]">
                <label class="label text-xs mb-1 block">🎨 Portrait Generation Prompt</label>
                <textarea v-model="portraitPrompt" class="input w-full text-xs" rows="3" />
                <button
                  @click="generatePortrait"
                  :disabled="generatingForNpc === editingNpcData.id"
                  class="btn !text-xs !py-1.5 mt-2 w-full flex items-center justify-center gap-2"
                >
                  <svg v-if="generatingForNpc === editingNpcData.id" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {{ generatingForNpc === editingNpcData.id ? 'Generating portrait...' : '🎨 Generate Portrait' }}
                </button>
                <div v-if="genError && generatingForNpc === editingNpcData.id" class="text-red-400 text-xs mt-1">{{ genError }}</div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button @click="closeEditModal" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="savingEdit || !editForm.name.trim()" class="btn text-sm">
                {{ savingEdit ? 'Saving...' : '💾 Save' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

  </div>
</template>

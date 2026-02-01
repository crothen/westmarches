<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import type { Npc, NpcNote, Organization } from '../types'

const auth = useAuthStore()
const { error: genError, generateImage } = useImageGen()

const npcs = ref<Npc[]>([])
const orgs = ref<Organization[]>([])
const npcNotes = ref<Record<string, NpcNote[]>>({})
const loading = ref(true)
const searchQuery = ref('')
const filterTag = ref<string | null>(null)
const expandedNpc = ref<string | null>(null)
const generatingForNpc = ref<string | null>(null)

// Edit state
const editingNpc = ref<string | null>(null)
const editForm = ref({ name: '', race: '', description: '', locationEncountered: '', tags: '' })

// Note state
const newNoteNpc = ref<string | null>(null)
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const savingNote = ref(false)

onMounted(async () => {
  try {
    const [npcSnap, orgSnap] = await Promise.all([
      getDocs(query(collection(db, 'npcs'), orderBy('name', 'asc'))),
      getDocs(query(collection(db, 'organizations'), orderBy('name', 'asc'))),
    ])
    npcs.value = npcSnap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
    orgs.value = orgSnap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))

    // Load notes
    if (auth.isAuthenticated) {
      const noteSnap = await getDocs(query(collection(db, 'npcNotes'), orderBy('createdAt', 'desc')))
      const allNotes = noteSnap.docs.map(d => ({ id: d.id, ...d.data() } as NpcNote))
      // Group by npcId, filter private notes client-side
      for (const note of allNotes) {
        if (note.isPrivate && note.userId !== auth.firebaseUser?.uid && !auth.isDm && !auth.isAdmin) continue
        if (!npcNotes.value[note.npcId]) npcNotes.value[note.npcId] = []
        npcNotes.value[note.npcId]!.push(note)
      }
    }
  } catch (e) {
    console.error('Failed to load NPCs:', e)
    // Auto-expand from hash link
    if (window.location.hash) {
      const targetId = window.location.hash.slice(1)
      if (npcs.value.some(n => n.id === targetId)) {
        expandedNpc.value = targetId
        await nextTick()
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
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

function toggleExpand(id: string) {
  if (editingNpc.value === id) return // don't collapse while editing
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

function getOrgsForNpc(npc: Npc): Organization[] {
  if (!npc.organizationIds?.length) return []
  return orgs.value.filter(o => npc.organizationIds.includes(o.id))
}

// --- Editing ---
function startEdit(npc: Npc) {
  editingNpc.value = npc.id
  editForm.value = {
    name: npc.name,
    race: npc.race || '',
    description: npc.description || '',
    locationEncountered: npc.locationEncountered || '',
    tags: (npc.tags || []).join(', '),
  }
}

function cancelEdit() {
  editingNpc.value = null
}

async function saveEdit(npc: Npc) {
  const updates: Partial<Npc> = {
    name: editForm.value.name.trim(),
    race: editForm.value.race.trim(),
    description: editForm.value.description.trim(),
    locationEncountered: editForm.value.locationEncountered.trim(),
    tags: editForm.value.tags.split(',').map(t => t.trim()).filter(Boolean),
    updatedAt: new Date(),
  }

  try {
    await updateDoc(doc(db, 'npcs', npc.id), updates as any)
    Object.assign(npc, updates)
    editingNpc.value = null
  } catch (e) {
    console.error('Failed to save NPC:', e)
    alert('Failed to save. Check your permissions.')
  }
}

// --- Notes ---
function startNote(npcId: string) {
  newNoteNpc.value = npcId
  newNoteContent.value = ''
  newNotePrivate.value = false
}

async function saveNote(npcId: string) {
  if (!newNoteContent.value.trim()) return
  savingNote.value = true
  try {
    const note: Omit<NpcNote, 'id'> = {
      npcId,
      userId: auth.firebaseUser!.uid,
      authorName: auth.appUser?.displayName || 'Unknown',
      content: newNoteContent.value.trim(),
      isPrivate: newNotePrivate.value,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const docRef = await addDoc(collection(db, 'npcNotes'), note)
    const saved: NpcNote = { id: docRef.id, ...note }
    if (!npcNotes.value[npcId]) npcNotes.value[npcId] = []
    npcNotes.value[npcId]!.unshift(saved)
    newNoteNpc.value = null
    newNoteContent.value = ''
  } catch (e) {
    console.error('Failed to save note:', e)
    alert('Failed to save note.')
  } finally {
    savingNote.value = false
  }
}

async function deleteNote(note: NpcNote) {
  if (!confirm('Delete this note?')) return
  try {
    await deleteDoc(doc(db, 'npcNotes', note.id))
    const arr = npcNotes.value[note.npcId]
    if (arr) {
      const idx = arr.findIndex(n => n.id === note.id)
      if (idx >= 0) arr.splice(idx, 1)
    }
  } catch (e) {
    console.error('Failed to delete note:', e)
  }
}

function canDeleteNote(note: NpcNote) {
  return note.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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
        :id="npc.id"
        :class="['card relative z-10 cursor-pointer', isDeceased(npc) ? 'opacity-50' : '']"
        @click="toggleExpand(npc.id)"
      >
        <div class="relative z-10">
          <!-- Portrait -->
          <div v-if="npc.imageUrl" class="overflow-hidden">
            <img :src="npc.imageUrl" class="w-full h-40 object-cover rounded-t-xl" />
          </div>
          <div class="p-5">

          <!-- EDIT MODE -->
          <template v-if="editingNpc === npc.id">
            <div class="space-y-3" @click.stop>
              <div>
                <label class="label text-xs">Name</label>
                <input v-model="editForm.name" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs">Race</label>
                <input v-model="editForm.race" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs">Description</label>
                <textarea v-model="editForm.description" class="input w-full" rows="3" />
              </div>
              <div>
                <label class="label text-xs">Location Encountered</label>
                <input v-model="editForm.locationEncountered" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs">Tags (comma-separated)</label>
                <input v-model="editForm.tags" class="input w-full" placeholder="e.g. ZFC, leader, quest-giver" />
              </div>
              <div class="flex gap-2 pt-1">
                <button @click.stop="saveEdit(npc)" class="btn !text-xs !py-1.5">💾 Save</button>
                <button @click.stop="cancelEdit" class="btn !text-xs !py-1.5 !bg-white/5 !text-zinc-400">Cancel</button>
              </div>
            </div>
          </template>

          <!-- VIEW MODE -->
          <template v-else>
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
              <div v-if="getOrgsForNpc(npc).length" class="mt-2">
                <span class="text-zinc-600 text-xs">🏛️ </span>
                <RouterLink
                  v-for="(org, i) in getOrgsForNpc(npc)" :key="org.id"
                  :to="'/organizations#' + org.id"
                  class="text-xs text-zinc-400 hover:text-[#ef233c] transition-colors"
                  @click.stop
                >{{ org.name }}<span v-if="i < getOrgsForNpc(npc).length - 1">, </span></RouterLink>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-wrap gap-2 mt-3" @click.stop>
                <button v-if="auth.isAuthenticated" @click.stop="startEdit(npc)" class="btn !text-[0.65rem] !py-1.5 !px-3">✏️ Edit</button>
                <button v-if="auth.isAuthenticated" @click.stop="startNote(npc.id)" class="btn !text-[0.65rem] !py-1.5 !px-3 !bg-white/5 !text-zinc-400">📝 Add Note</button>
                <button
                  v-if="auth.isAuthenticated"
                  @click.stop="generatePortrait(npc)"
                  :disabled="generatingForNpc === npc.id"
                  class="btn !text-[0.65rem] !py-1.5 !px-3 !bg-white/5 !text-zinc-400"
                >
                  {{ generatingForNpc === npc.id ? '🎨 Generating...' : '🎨 Generate Portrait' }}
                </button>
              </div>
              <div v-if="genError && generatingForNpc === npc.id" class="text-red-400 text-xs mt-1">{{ genError }}</div>

              <!-- Add Note Form -->
              <div v-if="newNoteNpc === npc.id" class="mt-3 pt-3 border-t border-white/[0.06] space-y-2" @click.stop>
                <textarea v-model="newNoteContent" class="input w-full text-sm" rows="2" placeholder="Write a note about this NPC..." />
                <div class="flex items-center justify-between">
                  <label class="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
                    <input type="checkbox" v-model="newNotePrivate" class="rounded border-white/10 bg-white/5" />
                    <span>🔒 Private (only you {{ auth.isDm || auth.isAdmin ? '' : '& DMs' }} can see)</span>
                  </label>
                  <div class="flex gap-2">
                    <button @click.stop="newNoteNpc = null" class="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                    <button @click.stop="saveNote(npc.id)" :disabled="savingNote || !newNoteContent.trim()" class="btn !text-xs !py-1 !px-3">Save</button>
                  </div>
                </div>
              </div>

              <!-- Notes list -->
              <div v-if="npcNotes[npc.id]?.length" class="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                <h4 class="label text-xs">Notes</h4>
                <div
                  v-for="note in npcNotes[npc.id]" :key="note.id"
                  :class="['p-2.5 rounded-lg text-sm', note.isPrivate ? 'bg-amber-500/5 border border-amber-500/10' : 'bg-white/[0.03]']"
                  @click.stop
                >
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                      <span class="text-zinc-400 text-xs font-medium">{{ note.authorName }}</span>
                      <span v-if="note.isPrivate" class="text-[0.6rem] text-amber-500/70">🔒 Private</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-zinc-600 text-[0.65rem]">{{ formatDate(note.createdAt) }}</span>
                      <button v-if="canDeleteNote(note)" @click.stop="deleteNote(note)" class="text-zinc-700 hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                  </div>
                  <p class="text-zinc-400 text-sm whitespace-pre-wrap">{{ note.content }}</p>
                </div>
              </div>
            </div>

            <!-- Tags row (collapsed) -->
            <div v-if="expandedNpc !== npc.id && npc.locationEncountered" class="mt-2">
              <span class="text-xs text-zinc-600">📍 {{ npc.locationEncountered }}</span>
            </div>
          </template>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

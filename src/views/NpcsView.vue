<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore'
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

// Modal edit state
const showEditModal = ref(false)
const editingNpcData = ref<Npc | null>(null)
const editForm = ref({ name: '', race: '', description: '', locationEncountered: '', tags: '' })
const savingEdit = ref(false)
const portraitPrompt = ref('')

// Note state
const newNoteNpc = ref<string | null>(null)
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const savingNote = ref(false)
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')


onMounted(async () => {
  try {
    const [npcSnap, orgSnap] = await Promise.all([
      getDocs(query(collection(db, 'npcs'), orderBy('name', 'asc'))),
      getDocs(query(collection(db, 'organizations'), orderBy('name', 'asc'))),
    ])
    npcs.value = npcSnap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
    orgs.value = orgSnap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))

    if (auth.isAuthenticated) {
      const noteSnap = await getDocs(query(collection(db, 'npcNotes'), orderBy('createdAt', 'desc')))
      const allNotes = noteSnap.docs.map(d => ({ id: d.id, ...d.data() } as NpcNote))
      for (const note of allNotes) {
        if (note.isPrivate && note.userId !== auth.firebaseUser?.uid && !auth.isDm && !auth.isAdmin) continue
        if (!npcNotes.value[note.npcId]) npcNotes.value[note.npcId] = []
        npcNotes.value[note.npcId]!.push(note)
      }
    }

    if (window.location.hash) {
      const targetId = window.location.hash.slice(1)
      if (npcs.value.some(n => n.id === targetId)) {
        expandedNpc.value = targetId
        await nextTick()
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
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

function toggleExpand(id: string) {
  expandedNpc.value = expandedNpc.value === id ? null : id
}

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

function getOrgsForNpc(npc: Npc): Organization[] {
  if (!npc.organizationIds?.length) return []
  return orgs.value.filter(o => npc.organizationIds.includes(o.id))
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
    tags: (npc.tags || []).join(', '),
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
    tags: editForm.value.tags.split(',').map(t => t.trim()).filter(Boolean),
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

// --- Notes ---
function startNote(npcId: string) {
  newNoteNpc.value = npcId
  newNoteContent.value = ''
  newNotePrivate.value = false
}

function startEditNote(note: NpcNote) {
  editingNoteId.value = note.id
  editingNoteContent.value = note.content
}

function cancelEditNote() {
  editingNoteId.value = null
  editingNoteContent.value = ''
}

async function saveEditNote(note: NpcNote) {
  if (!editingNoteContent.value.trim()) return
  try {
    await updateDoc(doc(db, 'npcNotes', note.id), { content: editingNoteContent.value.trim(), updatedAt: new Date() })
    note.content = editingNoteContent.value.trim()
    editingNoteId.value = null
    editingNoteContent.value = ''
  } catch (e) {
    console.error('Failed to edit note:', e)
  }
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
      replies: [],
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
    await updateDoc(doc(db, 'npcNotes', note.id), { content: '', deleted: true, deletedBy: auth.firebaseUser?.uid, updatedAt: new Date() })
    ;(note as any).deleted = true
    note.content = ''
  } catch (e) {
    console.error('Failed to delete note:', e)
  }
}

function canEditNote(note: NpcNote) {
  return note.userId === auth.firebaseUser?.uid && !(note as any).deleted
}

function canDeleteNote(note: NpcNote) {
  return (note.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !(note as any).deleted
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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
            <!-- Header -->
            <div class="flex items-start justify-between mb-2">
              <div>
                <RouterLink
                  :to="'/npcs/' + npc.id"
                  class="text-base font-semibold hover:text-[#ef233c] transition-colors"
                  :class="isDeceased(npc) ? 'line-through text-zinc-500' : 'text-white'"
                  style="font-family: Manrope, sans-serif"
                  @click.stop
                >{{ npc.name }}</RouterLink>
                <div class="text-zinc-500 text-sm">{{ npc.race }}</div>
              </div>
              <div class="flex items-center gap-1.5">
                <span v-if="noteCount(npc.id)" class="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500/80" :title="noteCount(npc.id) + ' note(s)'">📝 {{ noteCount(npc.id) }}</span>
                <span v-if="getRoleBadge(npc)" class="badge bg-[#ef233c]/15 text-[#ef233c]">{{ getRoleBadge(npc) }}</span>
                <span v-if="getUnitAbbrev(npc)" class="badge bg-white/5 text-zinc-400">{{ getUnitAbbrev(npc) }}</span>
                <span v-if="isDeceased(npc)" class="badge bg-zinc-800 text-zinc-500">☠️ Dead</span>
                <button
                  v-if="auth.isDm || auth.isAdmin"
                  @click.stop="openEditModal(npc)"
                  class="text-zinc-600 hover:text-zinc-300 text-sm transition-colors ml-1"
                  title="Edit NPC"
                >✏️</button>
              </div>
            </div>

            <!-- Description preview -->
            <p :class="['text-sm mt-2', expandedNpc === npc.id ? 'text-zinc-300' : 'text-zinc-500 line-clamp-2']">{{ npc.description }}</p>

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
                <button v-if="auth.isAuthenticated && !auth.isDm && !auth.isAdmin" @click.stop="openEditModal(npc)" class="btn !text-[0.65rem] !py-1.5 !px-3">✏️ Edit</button>
                <button v-if="auth.isAuthenticated" @click.stop="startNote(npc.id)" class="btn !text-[0.65rem] !py-1.5 !px-3 !bg-white/5 !text-zinc-400">📝 Add Note</button>
                <RouterLink :to="'/npcs/' + npc.id" class="btn !text-[0.65rem] !py-1.5 !px-3 !bg-white/5 !text-zinc-400" @click.stop>📄 Detail Page</RouterLink>
              </div>

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
                  :class="['p-2.5 rounded-lg text-sm', (note as any).deleted ? 'bg-white/[0.01]' : note.isPrivate ? 'bg-amber-500/5 border border-amber-500/10' : 'bg-white/[0.03]']"
                  @click.stop
                >
                  <div v-if="(note as any).deleted" class="text-zinc-600 text-xs italic">🗑️ This note was deleted</div>
                  <template v-else>
                    <div class="flex items-center justify-between mb-1">
                      <div class="flex items-center gap-2">
                        <span class="text-zinc-400 text-xs font-medium">{{ note.authorName }}</span>
                        <span v-if="note.isPrivate" class="text-[0.6rem] text-amber-500/70">🔒 Private</span>
                        <span class="text-zinc-600 text-[0.65rem]">{{ formatDate(note.createdAt) }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button v-if="canEditNote(note)" @click.stop="startEditNote(note)" class="text-zinc-500 hover:text-[#ef233c] text-xs transition-colors">Edit</button>
                        <button v-if="canDeleteNote(note)" @click.stop="deleteNote(note)" class="text-zinc-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                      </div>
                    </div>
                    <div v-if="editingNoteId === note.id" class="space-y-2">
                      <textarea v-model="editingNoteContent" class="input w-full text-sm" rows="2" />
                      <div class="flex gap-2 justify-end">
                        <button @click.stop="cancelEditNote" class="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                        <button @click.stop="saveEditNote(note)" class="btn !text-xs !py-1 !px-3">Save</button>
                      </div>
                    </div>
                    <p v-else class="text-zinc-400 text-sm whitespace-pre-wrap">{{ note.content }}</p>
                  </template>
                </div>
              </div>
            </div>

            <!-- Collapsed footer -->
            <div v-if="expandedNpc !== npc.id" class="mt-2 flex items-center gap-2">
              <span v-if="npc.locationEncountered" class="text-xs text-zinc-600">📍 {{ npc.locationEncountered }}</span>
            </div>
          </div>
        </div>
      </div>
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
                <label class="label text-xs mb-1 block">Tags (comma-separated)</label>
                <input v-model="editForm.tags" class="input w-full" placeholder="e.g. ZFC, leader, quest-giver" />
              </div>

              <!-- Portrait Generation -->
              <div class="pt-2 border-t border-white/[0.06]">
                <label class="label text-xs mb-1 block">🎨 Portrait Generation Prompt</label>
                <textarea v-model="portraitPrompt" class="input w-full text-xs" rows="3" />
                <button
                  @click="generatePortrait"
                  :disabled="generatingForNpc === editingNpcData.id"
                  class="btn !text-xs !py-1.5 mt-2 w-full"
                >
                  {{ generatingForNpc === editingNpcData.id ? '🎨 Generating portrait...' : '🎨 Generate Portrait' }}
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

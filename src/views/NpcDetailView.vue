<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, getDocs, query, orderBy, where, updateDoc, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import type { Npc, NpcNote, Organization } from '../types'

const route = useRoute()
const auth = useAuthStore()
const { error: genError, generateImage } = useImageGen()

const npc = ref<Npc | null>(null)
const orgs = ref<Organization[]>([])
const notes = ref<NpcNote[]>([])
const loading = ref(true)

// Edit state
const showEditModal = ref(false)
const editForm = ref({ name: '', race: '', description: '', locationEncountered: '', tags: '' })
const savingEdit = ref(false)
const portraitPrompt = ref('')
const generatingPortrait = ref(false)

// Note state
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const savingNote = ref(false)
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')
const replyingTo = ref<string | null>(null)
const replyContent = ref('')

const npcId = computed(() => route.params.id as string)

onMounted(async () => {
  try {
    const snap = await getDoc(doc(db, 'npcs', npcId.value))
    if (snap.exists()) {
      npc.value = { id: snap.id, ...snap.data() } as Npc
    }

    // Load orgs
    const orgSnap = await getDocs(query(collection(db, 'organizations'), orderBy('name', 'asc')))
    orgs.value = orgSnap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))

    // Load notes for this NPC
    if (auth.isAuthenticated) {
      const noteSnap = await getDocs(query(collection(db, 'npcNotes'), where('npcId', '==', npcId.value), orderBy('createdAt', 'desc')))
      notes.value = noteSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as NpcNote))
        .filter(note => {
          if (note.isPrivate && note.userId !== auth.firebaseUser?.uid && !auth.isDm && !auth.isAdmin) return false
          return true
        })
    }
  } catch (e) {
    console.error('Failed to load NPC:', e)
  } finally {
    loading.value = false
  }
})

const npcOrgs = computed(() => {
  if (!npc.value?.organizationIds?.length) return []
  return orgs.value.filter(o => npc.value!.organizationIds.includes(o.id))
})

const isDeceased = computed(() => (npc.value?.tags || []).includes('deceased'))

function getRoleBadge(): string | null {
  if (!npc.value) return null
  if ((npc.value.tags || []).includes('commander')) return 'Commander'
  if ((npc.value.tags || []).includes('leader')) return 'Leader'
  if ((npc.value.tags || []).includes('subleader')) return 'Vice-Leader'
  return null
}

function getUnitAbbrev(): string | null {
  if (!npc.value) return null
  const unitTags = ['ZFC', 'LDU', 'DDU', 'GDU', 'PCU', 'EFDU', 'UEU', 'VIU']
  return (npc.value.tags || []).find(t => unitTags.includes(t)) || null
}

function getDefaultPortraitPrompt(): string {
  if (!npc.value) return ''
  return `Fantasy character portrait for a D&D RPG. ${npc.value.name}, a ${npc.value.race || 'unknown race'}. ${npc.value.description || ''}. Style: detailed fantasy art, medieval setting, dramatic lighting, painterly. Head and shoulders portrait.`
}

// --- Edit ---
function openEditModal() {
  if (!npc.value) return
  editForm.value = {
    name: npc.value.name,
    race: npc.value.race || '',
    description: npc.value.description || '',
    locationEncountered: npc.value.locationEncountered || '',
    tags: (npc.value.tags || []).join(', '),
  }
  portraitPrompt.value = getDefaultPortraitPrompt()
  showEditModal.value = true
}

async function saveEdit() {
  if (!npc.value) return
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
    await updateDoc(doc(db, 'npcs', npc.value.id), updates as any)
    Object.assign(npc.value, updates)
    showEditModal.value = false
  } catch (e) {
    console.error('Failed to save NPC:', e)
    alert('Failed to save.')
  } finally {
    savingEdit.value = false
  }
}

async function generatePortrait() {
  if (!npc.value) return
  generatingPortrait.value = true
  const url = await generateImage(portraitPrompt.value, `npc-portraits/${npc.value.id}`)
  if (url) {
    await updateDoc(doc(db, 'npcs', npc.value.id), { imageUrl: url })
    npc.value.imageUrl = url
  }
  generatingPortrait.value = false
}

// --- Notes ---
async function addNote() {
  if (!newNoteContent.value.trim() || !auth.firebaseUser || !npc.value) return
  savingNote.value = true
  try {
    const note: Omit<NpcNote, 'id'> = {
      npcId: npc.value.id,
      userId: auth.firebaseUser.uid,
      authorName: auth.appUser?.displayName || 'Unknown',
      content: newNoteContent.value.trim(),
      isPrivate: newNotePrivate.value,
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const docRef = await addDoc(collection(db, 'npcNotes'), note)
    notes.value.unshift({ id: docRef.id, ...note })
    newNoteContent.value = ''
    newNotePrivate.value = false
  } catch (e) {
    console.error('Failed to save note:', e)
  } finally {
    savingNote.value = false
  }
}

function startEditNote(note: NpcNote) {
  editingNoteId.value = note.id
  editingNoteContent.value = note.content
}

async function saveEditNote(note: NpcNote) {
  if (!editingNoteContent.value.trim()) return
  try {
    await updateDoc(doc(db, 'npcNotes', note.id), { content: editingNoteContent.value.trim(), updatedAt: new Date() })
    note.content = editingNoteContent.value.trim()
    editingNoteId.value = null
  } catch (e) {
    console.error('Failed to edit note:', e)
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

async function addReply(noteId: string) {
  if (!replyContent.value.trim() || !auth.firebaseUser) return
  const note = notes.value.find(n => n.id === noteId)
  if (!note) return

  const newReply = {
    id: crypto.randomUUID(),
    userId: auth.firebaseUser.uid,
    authorName: auth.appUser?.displayName || 'Unknown',
    content: replyContent.value.trim(),
    createdAt: Timestamp.now()
  }

  const currentReplies = note.replies || []
  await updateDoc(doc(db, 'npcNotes', noteId), {
    replies: [...currentReplies, newReply],
    updatedAt: Timestamp.now()
  })
  // Update local state
  note.replies = [...currentReplies, newReply] as any
  replyContent.value = ''
  replyingTo.value = null
}

async function deleteReply(noteId: string, replyId: string) {
  const note = notes.value.find(n => n.id === noteId)
  if (!note) return
  const updatedReplies = (note.replies || []).map(r =>
    r.id === replyId ? { ...r, content: '', deleted: true } : r
  )
  await updateDoc(doc(db, 'npcNotes', noteId), {
    replies: updatedReplies,
    updatedAt: Timestamp.now()
  })
  note.replies = updatedReplies as any
}

function canDeleteReply(reply: any): boolean {
  return (reply.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !reply.deleted
}

function canEditNote(note: NpcNote) { return note.userId === auth.firebaseUser?.uid && !(note as any).deleted }
function canDeleteNote(note: NpcNote) { return (note.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !(note as any).deleted }

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <RouterLink to="/npcs" class="text-[#ef233c] hover:text-red-400 text-sm mb-4 inline-block transition-colors">← Back to NPCs</RouterLink>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="!npc" class="text-center py-12">
      <p class="text-zinc-500">NPC not found.</p>
    </div>

    <div v-else>
      <!-- Hero section -->
      <div class="flex flex-col md:flex-row gap-6 mb-8">
        <!-- Portrait -->
        <div class="md:w-64 shrink-0">
          <div v-if="npc.imageUrl" class="overflow-hidden rounded-xl border border-white/10">
            <img :src="npc.imageUrl" class="w-full object-cover" />
          </div>
          <div v-else class="w-full h-64 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <span class="text-4xl">👤</span>
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h1 :class="['text-3xl font-bold', isDeceased ? 'line-through text-zinc-500' : 'text-white']" style="font-family: Manrope, sans-serif">{{ npc.name }}</h1>
              <span class="text-zinc-500 text-lg">{{ npc.race }}</span>
            </div>
            <button
              v-if="auth.isAuthenticated"
              @click="openEditModal"
              class="btn !text-xs !py-1.5"
            >✏️ Edit</button>
          </div>

          <div class="flex flex-wrap gap-2 mt-3">
            <span v-if="getRoleBadge()" class="badge bg-[#ef233c]/15 text-[#ef233c]">{{ getRoleBadge() }}</span>
            <span v-if="getUnitAbbrev()" class="badge bg-white/5 text-zinc-400">{{ getUnitAbbrev() }}</span>
            <span v-if="isDeceased" class="badge bg-zinc-800 text-zinc-500">☠️ Deceased</span>
            <span v-for="tag in (npc.tags || []).filter(t => !['commander','leader','subleader','deceased','ZFC','LDU','DDU','GDU','PCU','EFDU','UEU','VIU'].includes(t))" :key="tag" class="text-[0.65rem] px-2 py-0.5 rounded-full bg-white/5 text-zinc-500">{{ tag }}</span>
          </div>

          <div class="card mt-4 p-4 relative z-10">
            <div class="relative z-10">
              <p class="text-zinc-300 whitespace-pre-wrap">{{ npc.description }}</p>
            </div>
          </div>

          <div v-if="npc.locationEncountered" class="mt-3 text-sm">
            <span class="text-zinc-600">📍 First encountered at:</span>
            <span class="text-zinc-400 ml-1">{{ npc.locationEncountered }}</span>
          </div>

          <!-- Organizations -->
          <div v-if="npcOrgs.length" class="mt-3">
            <span class="text-zinc-600 text-sm">🏛️ Organizations: </span>
            <RouterLink
              v-for="(org, i) in npcOrgs" :key="org.id"
              :to="'/organizations#' + org.id"
              class="text-sm text-zinc-400 hover:text-[#ef233c] transition-colors"
            >{{ org.name }}<span v-if="i < npcOrgs.length - 1">, </span></RouterLink>
          </div>
        </div>
      </div>

      <!-- Notes Section -->
      <div class="border-t border-white/[0.06] pt-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-4" style="font-family: Manrope, sans-serif">📝 Notes</h2>

        <div v-if="notes.length === 0" class="text-zinc-600 text-sm mb-4">No notes yet.</div>

        <div v-for="note in notes" :key="note.id" class="card p-4 mb-3 relative z-10">
          <div class="relative z-10">
            <div v-if="(note as any).deleted" class="text-zinc-600 text-sm italic">🗑️ This note was deleted</div>
            <template v-else>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-[#ef233c] font-medium text-sm">{{ note.authorName }}</span>
                  <span v-if="note.isPrivate" class="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md border border-red-500/20">🔒 Private</span>
                  <span class="text-zinc-600 text-xs">{{ formatDate(note.createdAt) }}</span>
                </div>
                <div class="flex gap-2">
                  <button v-if="canEditNote(note)" @click="startEditNote(note)" class="text-zinc-500 hover:text-[#ef233c] text-xs transition-colors">Edit</button>
                  <button v-if="canDeleteNote(note)" @click="deleteNote(note)" class="text-zinc-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                </div>
              </div>
              <div v-if="editingNoteId === note.id">
                <textarea v-model="editingNoteContent" rows="3" class="input w-full text-sm mb-2" />
                <div class="flex gap-2 justify-end">
                  <button @click="editingNoteId = null" class="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                  <button @click="saveEditNote(note)" class="btn text-sm !py-1 !px-3">Save</button>
                </div>
              </div>
              <p v-else class="text-zinc-300 text-sm whitespace-pre-wrap">{{ note.content }}</p>

              <!-- Replies -->
              <div v-if="note.replies?.length" class="mt-2 pl-3 border-l border-white/[0.06] space-y-2">
                <div v-for="reply in note.replies" :key="reply.id" class="text-sm">
                  <div v-if="reply.deleted" class="text-zinc-600 text-xs italic">🗑️ This reply was deleted</div>
                  <template v-else>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[#ef233c]/80 text-xs font-medium">{{ reply.authorName }}</span>
                        <span class="text-zinc-600 text-[0.65rem]">{{ formatDate(reply.createdAt) }}</span>
                      </div>
                      <button v-if="canDeleteReply(reply)" @click="deleteReply(note.id, reply.id)" class="text-zinc-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                    </div>
                    <p class="text-zinc-400 text-sm">{{ reply.content }}</p>
                  </template>
                </div>
              </div>

              <!-- Reply button / form -->
              <div v-if="auth.isAuthenticated" class="mt-2">
                <button v-if="replyingTo !== note.id" @click="replyingTo = note.id" class="text-zinc-600 hover:text-[#ef233c] text-xs transition-colors">Reply</button>
                <div v-else class="mt-1.5">
                  <textarea v-model="replyContent" rows="2" placeholder="Write a reply..." class="input w-full text-sm" />
                  <div class="flex gap-2 mt-1.5 justify-end">
                    <button @click="replyingTo = null; replyContent = ''" class="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">Cancel</button>
                    <button @click="addReply(note.id)" :disabled="!replyContent.trim()" class="btn !text-xs !py-1 !px-3">Reply</button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Add Note -->
        <div v-if="auth.isAuthenticated" class="card p-4 mt-4 relative z-10">
          <div class="relative z-10">
            <textarea v-model="newNoteContent" rows="3" placeholder="Write a note about this NPC..." class="input w-full text-sm mb-3" />
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 text-sm text-zinc-500">
                <input v-model="newNotePrivate" type="checkbox" class="accent-[#ef233c]" />
                🔒 Private
              </label>
              <button @click="addNote" :disabled="savingNote || !newNoteContent.trim()" class="btn text-sm">Add Note</button>
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
        <div v-if="showEditModal && npc" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showEditModal = false" />
          <div class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit {{ npc.name }}</h3>
              <button @click="showEditModal = false" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <div v-if="npc.imageUrl" class="overflow-hidden rounded-xl">
              <img :src="npc.imageUrl" class="w-full h-48 object-cover" />
            </div>

            <div class="space-y-3">
              <div><label class="label text-xs mb-1 block">Name</label><input v-model="editForm.name" class="input w-full" /></div>
              <div><label class="label text-xs mb-1 block">Race</label><input v-model="editForm.race" class="input w-full" /></div>
              <div><label class="label text-xs mb-1 block">Description</label><textarea v-model="editForm.description" class="input w-full" rows="4" /></div>
              <div><label class="label text-xs mb-1 block">Location Encountered</label><input v-model="editForm.locationEncountered" class="input w-full" /></div>
              <div><label class="label text-xs mb-1 block">Tags (comma-separated)</label><input v-model="editForm.tags" class="input w-full" placeholder="e.g. ZFC, leader" /></div>

              <div class="pt-2 border-t border-white/[0.06]">
                <label class="label text-xs mb-1 block">🎨 Portrait Generation Prompt</label>
                <textarea v-model="portraitPrompt" class="input w-full text-xs" rows="3" />
                <button @click="generatePortrait" :disabled="generatingPortrait" class="btn !text-xs !py-1.5 mt-2 w-full">
                  {{ generatingPortrait ? '🎨 Generating portrait...' : '🎨 Generate Portrait' }}
                </button>
                <div v-if="genError && generatingPortrait" class="text-red-400 text-xs mt-1">{{ genError }}</div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button @click="showEditModal = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="savingEdit || !editForm.name.trim()" class="btn text-sm">{{ savingEdit ? 'Saving...' : '💾 Save' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

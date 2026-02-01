<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import type { SessionLog, SessionNote } from '../types'

const route = useRoute()
const auth = useAuthStore()
const { generating: genLoading, error: genError, generateImage } = useImageGen()
const session = ref<SessionLog | null>(null)
const notes = ref<SessionNote[]>([])
const loading = ref(true)
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const editingNoteId = ref<string | null>(null)
const editContent = ref('')
const replyingTo = ref<string | null>(null)
const replyContent = ref('')
let unsubNotes: (() => void) | null = null

const sessionId = computed(() => route.params.id as string)

const visibleNotes = computed(() => {
  return notes.value.filter(note => {
    if (!note.isPrivate) return true
    if (auth.isDm) return true
    if (note.userId === auth.firebaseUser?.uid) return true
    return false
  })
})

onMounted(async () => {
  try {
    const snap = await getDoc(doc(db, 'sessions', sessionId.value))
    if (snap.exists()) {
      session.value = { id: snap.id, ...snap.data() } as SessionLog
    }
  } catch (e) {
    console.error('Failed to load session:', e)
  } finally {
    loading.value = false
  }

  const notesQuery = query(
    collection(db, 'sessionNotes'),
    where('sessionId', '==', sessionId.value),
    orderBy('createdAt', 'asc')
  )
  unsubNotes = onSnapshot(notesQuery, (snap) => {
    notes.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionNote))
  }, (err) => {
    console.warn('Notes query error (index may need creating):', err.message)
  })
})

onUnmounted(() => {
  unsubNotes?.()
})

async function addNote() {
  if (!newNoteContent.value.trim() || !auth.firebaseUser) return
  await addDoc(collection(db, 'sessionNotes'), {
    sessionId: sessionId.value,
    userId: auth.firebaseUser.uid,
    authorName: auth.appUser?.displayName || 'Unknown',
    content: newNoteContent.value.trim(),
    isPrivate: newNotePrivate.value,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  newNoteContent.value = ''
  newNotePrivate.value = false
}

function startEdit(note: SessionNote) {
  editingNoteId.value = note.id
  editContent.value = note.content
}

function cancelEdit() {
  editingNoteId.value = null
  editContent.value = ''
}

async function saveEdit(noteId: string) {
  if (!editContent.value.trim()) return
  await updateDoc(doc(db, 'sessionNotes', noteId), {
    content: editContent.value.trim(),
    updatedAt: Timestamp.now()
  })
  editingNoteId.value = null
  editContent.value = ''
}

async function deleteNote(noteId: string) {
  if (!confirm('Delete this note?')) return
  // Soft delete
  await updateDoc(doc(db, 'sessionNotes', noteId), {
    content: '',
    deleted: true,
    deletedBy: auth.firebaseUser?.uid,
    updatedAt: Timestamp.now()
  })
}

async function generateSessionArt() {
  if (!session.value) return
  const participants = session.value.participants?.map(p => p.characterName).join(', ') || 'adventurers'
  const prompt = `Create a dramatic D&D fantasy scene illustration. Session title: "${session.value.title}". Summary: ${session.value.summary?.substring(0, 500)}. Characters involved: ${participants}. Style: epic fantasy art, dramatic lighting, painterly, wide landscape composition, medieval setting.`

  const url = await generateImage(prompt, `session-art/${session.value.id}`)
  if (url) {
    await updateDoc(doc(db, 'sessions', session.value.id), { imageUrl: url })
    session.value = { ...session.value, imageUrl: url } as any
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
  await updateDoc(doc(db, 'sessionNotes', noteId), {
    replies: [...currentReplies, newReply],
    updatedAt: Timestamp.now()
  })
  replyContent.value = ''
  replyingTo.value = null
}

async function deleteReply(noteId: string, replyId: string) {
  const note = notes.value.find(n => n.id === noteId)
  if (!note) return
  const updatedReplies = (note.replies || []).map(r =>
    r.id === replyId ? { ...r, content: '', deleted: true } : r
  )
  await updateDoc(doc(db, 'sessionNotes', noteId), {
    replies: updatedReplies,
    updatedAt: Timestamp.now()
  })
}

function canDeleteReply(reply: any): boolean {
  return (reply.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !reply.deleted
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Only author can edit their own notes */
function canEditNote(note: SessionNote): boolean {
  return note.userId === auth.firebaseUser?.uid && !(note as any).deleted
}

/** Author, DMs, and admins can delete notes */
function canDeleteNote(note: SessionNote): boolean {
  return (note.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !(note as any).deleted
}
</script>

<template>
  <div>
    <RouterLink to="/sessions" class="text-[#ef233c] hover:text-red-400 text-sm mb-4 inline-block transition-colors">← Back to Sessions</RouterLink>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="!session" class="text-center py-12">
      <p class="text-zinc-500">Session not found.</p>
    </div>

    <div v-else>
      <div class="flex items-center gap-3 mb-2">
        <span class="text-[#ef233c] font-bold text-2xl" style="font-family: Manrope, sans-serif">Session {{ session.sessionNumber }}</span>
        <span class="text-zinc-600">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
      </div>
      <h1 class="text-3xl font-bold text-white mb-6" style="font-family: Manrope, sans-serif">{{ session.title }}</h1>

      <!-- Session Art -->
      <div v-if="(session as any).imageUrl" class="mb-6 -mx-1">
        <img :src="(session as any).imageUrl" class="w-full max-h-80 object-cover rounded-xl border border-white/10" />
      </div>

      <button
        v-if="auth.isAuthenticated && !(session as any).imageUrl"
        @click="generateSessionArt"
        :disabled="genLoading"
        class="btn !text-[0.65rem] !py-1.5 !px-3 mb-6"
      >
        {{ genLoading ? '🎨 Generating scene...' : '🎨 Generate Scene Art' }}
      </button>
      <div v-if="genError" class="text-red-400 text-xs mb-4">{{ genError }}</div>

      <!-- Participants -->
      <div v-if="session.participants?.length" class="mb-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-2" style="font-family: Manrope, sans-serif">🧙 Adventurers</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="p in session.participants" :key="p.characterId" class="bg-white/[0.05] border border-white/[0.06] text-zinc-200 px-3 py-1 rounded-lg text-sm">
            {{ p.characterName }}
          </span>
        </div>
      </div>

      <!-- Summary -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-2" style="font-family: Manrope, sans-serif">📜 Summary</h2>
        <div class="card p-4 relative z-10">
          <div class="relative z-10 text-zinc-300 whitespace-pre-wrap">{{ session.summary }}</div>
        </div>
      </div>

      <!-- Loot -->
      <div v-if="session.loot?.length" class="mb-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-2" style="font-family: Manrope, sans-serif">💰 Loot</h2>
        <div class="card divide-y divide-white/[0.06] relative z-10">
          <div v-for="(item, i) in session.loot" :key="i" class="relative z-10 p-3 flex items-center justify-between">
            <div>
              <span class="text-zinc-100">{{ item.name }}</span>
              <span v-if="item.quantity > 1" class="text-zinc-500 ml-1">×{{ item.quantity }}</span>
              <span v-if="item.description" class="text-zinc-500 text-sm ml-2">— {{ item.description }}</span>
            </div>
            <span v-if="item.recipient" class="text-zinc-500 text-sm">→ {{ item.recipient }}</span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="session.tags?.length" class="mb-6 flex gap-2 flex-wrap">
        <span v-for="tag in session.tags" :key="tag" class="text-xs bg-white/[0.05] text-zinc-500 px-2 py-0.5 rounded-md border border-white/[0.06]">{{ tag }}</span>
      </div>

      <!-- Player Notes Section -->
      <div class="mt-8 border-t border-white/[0.06] pt-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-4" style="font-family: Manrope, sans-serif">📝 Player Notes</h2>

        <div v-if="visibleNotes.length === 0" class="text-zinc-600 text-sm mb-4">No notes yet. Be the first to add one!</div>

        <div v-for="note in visibleNotes" :key="note.id" class="card p-4 mb-3 relative z-10">
          <div class="relative z-10">
            <!-- Deleted placeholder -->
            <div v-if="(note as any).deleted" class="text-zinc-600 text-sm italic">
              🗑️ This note was deleted
            </div>
            <template v-else>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-[#ef233c] font-medium text-sm">{{ note.authorName }}</span>
                  <span v-if="note.isPrivate" class="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md border border-red-500/20">🔒 Private</span>
                  <span class="text-zinc-600 text-xs">{{ (note.createdAt as any)?.toDate ? new Date((note.createdAt as any).toDate()).toLocaleDateString() : '' }}</span>
                </div>
                <div class="flex gap-2">
                  <button v-if="canEditNote(note)" @click="startEdit(note)" class="text-zinc-500 hover:text-[#ef233c] text-xs transition-colors">Edit</button>
                  <button v-if="canDeleteNote(note)" @click="deleteNote(note.id)" class="text-zinc-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                </div>
              </div>

              <!-- Edit mode -->
              <div v-if="editingNoteId === note.id">
                <textarea v-model="editContent" rows="3" class="input w-full text-sm mb-2" />
                <div class="flex gap-2 justify-end">
                  <button @click="cancelEdit" class="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                  <button @click="saveEdit(note.id)" class="btn text-sm !py-1 !px-3">Save</button>
                </div>
              </div>

              <!-- Display mode -->
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

        <!-- Add Note Form -->
        <div v-if="auth.isAuthenticated" class="card p-4 mt-4 relative z-10">
          <div class="relative z-10">
            <textarea v-model="newNoteContent" rows="3" placeholder="Write your notes about this session..." class="input w-full text-sm mb-3" />
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 text-sm text-zinc-500">
                <input v-model="newNotePrivate" type="checkbox" class="accent-[#ef233c]" />
                🔒 Private (only you and DMs can see)
              </label>
              <button @click="addNote" :disabled="!newNoteContent.trim()" class="btn text-sm">
                Add Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

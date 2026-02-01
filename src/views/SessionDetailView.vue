<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { SessionLog, SessionNote } from '../types'

const route = useRoute()
const auth = useAuthStore()
const session = ref<SessionLog | null>(null)
const notes = ref<SessionNote[]>([])
const loading = ref(true)
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const editingNoteId = ref<string | null>(null)
const editContent = ref('')
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

  // Subscribe to notes for this session
  const notesQuery = query(
    collection(db, 'sessionNotes'),
    where('sessionId', '==', sessionId.value),
    orderBy('createdAt', 'asc')
  )
  unsubNotes = onSnapshot(notesQuery, (snap) => {
    notes.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionNote))
  }, (err) => {
    // Index might not exist yet, just log it
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
  await deleteDoc(doc(db, 'sessionNotes', noteId))
}

function canEditNote(note: SessionNote): boolean {
  return note.userId === auth.firebaseUser?.uid || auth.isDm
}
</script>

<template>
  <div>
    <RouterLink to="/sessions" class="text-amber-500 hover:text-amber-400 text-sm mb-4 inline-block transition-colors">← Back to Sessions</RouterLink>

    <div v-if="loading" class="text-slate-400 animate-pulse">Loading...</div>

    <div v-else-if="!session" class="text-center py-12">
      <p class="text-slate-400">Session not found.</p>
    </div>

    <div v-else>
      <div class="flex items-center gap-3 mb-2">
        <span class="text-amber-500 font-bold text-2xl">Session {{ session.sessionNumber }}</span>
        <span class="text-slate-500">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
      </div>
      <h1 class="text-3xl font-bold text-slate-100 mb-6">{{ session.title }}</h1>

      <!-- Participants -->
      <div v-if="session.participants?.length" class="mb-6">
        <h2 class="text-lg font-semibold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent mb-2">🧙 Adventurers</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="p in session.participants" :key="p.characterId" class="bg-white/[0.05] border border-white/[0.06] text-slate-200 px-3 py-1 rounded-lg text-sm">
            {{ p.characterName }}
          </span>
        </div>
      </div>

      <!-- Summary -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent mb-2">📜 Summary</h2>
        <div class="glass-card p-4 text-slate-300 whitespace-pre-wrap">{{ session.summary }}</div>
      </div>

      <!-- Loot -->
      <div v-if="session.loot?.length" class="mb-6">
        <h2 class="text-lg font-semibold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent mb-2">💰 Loot</h2>
        <div class="glass-card divide-y divide-white/[0.06]">
          <div v-for="(item, i) in session.loot" :key="i" class="p-3 flex items-center justify-between">
            <div>
              <span class="text-slate-100">{{ item.name }}</span>
              <span v-if="item.quantity > 1" class="text-slate-500 ml-1">×{{ item.quantity }}</span>
              <span v-if="item.description" class="text-slate-500 text-sm ml-2">— {{ item.description }}</span>
            </div>
            <span v-if="item.recipient" class="text-slate-400 text-sm">→ {{ item.recipient }}</span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="session.tags?.length" class="mb-6 flex gap-2 flex-wrap">
        <span v-for="tag in session.tags" :key="tag" class="text-xs bg-white/[0.05] text-slate-400 px-2 py-0.5 rounded-md border border-white/[0.06]">{{ tag }}</span>
      </div>

      <!-- Player Notes Section -->
      <div class="mt-8 border-t border-white/[0.06] pt-6">
        <h2 class="text-lg font-semibold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent mb-4">📝 Player Notes</h2>

        <!-- Existing Notes -->
        <div v-if="visibleNotes.length === 0" class="text-slate-500 text-sm mb-4">No notes yet. Be the first to add one!</div>

        <div v-for="note in visibleNotes" :key="note.id" class="glass-card p-4 mb-3">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-amber-500 font-medium text-sm">{{ note.authorName }}</span>
              <span v-if="note.isPrivate" class="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md border border-red-500/20">🔒 Private</span>
              <span class="text-slate-600 text-xs">{{ (note.createdAt as any)?.toDate ? new Date((note.createdAt as any).toDate()).toLocaleDateString() : '' }}</span>
            </div>
            <div v-if="canEditNote(note)" class="flex gap-2">
              <button @click="startEdit(note)" class="text-slate-500 hover:text-amber-500 text-xs transition-colors">Edit</button>
              <button @click="deleteNote(note.id)" class="text-slate-500 hover:text-red-400 text-xs transition-colors">Delete</button>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-if="editingNoteId === note.id">
            <textarea v-model="editContent" rows="3" class="modern-input w-full text-sm mb-2" />
            <div class="flex gap-2 justify-end">
              <button @click="cancelEdit" class="btn-secondary text-sm !py-1 !px-3">Cancel</button>
              <button @click="saveEdit(note.id)" class="btn-primary text-sm !py-1 !px-3">Save</button>
            </div>
          </div>

          <!-- Display mode -->
          <p v-else class="text-slate-300 text-sm whitespace-pre-wrap">{{ note.content }}</p>
        </div>

        <!-- Add Note Form -->
        <div v-if="auth.isAuthenticated" class="glass-card p-4 mt-4">
          <textarea v-model="newNoteContent" rows="3" placeholder="Write your notes about this session..." class="modern-input w-full text-sm mb-3" />
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-slate-400">
              <input v-model="newNotePrivate" type="checkbox" class="accent-amber-500" />
              🔒 Private (only you and DMs can see)
            </label>
            <button @click="addNote" :disabled="!newNoteContent.trim()" class="btn-primary text-sm">
              Add Note
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

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
    <RouterLink to="/sessions" class="text-amber-500 hover:text-amber-400 text-sm mb-4 inline-block">← Back to Sessions</RouterLink>

    <div v-if="loading" class="text-stone-400 animate-pulse">Loading...</div>

    <div v-else-if="!session" class="text-center py-12">
      <p class="text-stone-400">Session not found.</p>
    </div>

    <div v-else>
      <div class="flex items-center gap-3 mb-2">
        <span class="text-amber-500 font-bold text-2xl">Session {{ session.sessionNumber }}</span>
        <span class="text-stone-500">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
      </div>
      <h1 class="text-3xl font-bold text-stone-100 mb-6">{{ session.title }}</h1>

      <!-- Participants -->
      <div v-if="session.participants?.length" class="mb-6">
        <h2 class="text-lg font-semibold text-amber-500 mb-2">🧙 Adventurers</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="p in session.participants" :key="p.characterId" class="bg-stone-800 border border-stone-700 text-stone-200 px-3 py-1 rounded text-sm">
            {{ p.characterName }}
          </span>
        </div>
      </div>

      <!-- Summary -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-amber-500 mb-2">📜 Summary</h2>
        <div class="bg-stone-800 border border-stone-700 rounded-lg p-4 text-stone-300 whitespace-pre-wrap">{{ session.summary }}</div>
      </div>

      <!-- Loot -->
      <div v-if="session.loot?.length" class="mb-6">
        <h2 class="text-lg font-semibold text-amber-500 mb-2">💰 Loot</h2>
        <div class="bg-stone-800 border border-stone-700 rounded-lg divide-y divide-stone-700">
          <div v-for="(item, i) in session.loot" :key="i" class="p-3 flex items-center justify-between">
            <div>
              <span class="text-stone-100">{{ item.name }}</span>
              <span v-if="item.quantity > 1" class="text-stone-500 ml-1">×{{ item.quantity }}</span>
              <span v-if="item.description" class="text-stone-500 text-sm ml-2">— {{ item.description }}</span>
            </div>
            <span v-if="item.recipient" class="text-stone-400 text-sm">→ {{ item.recipient }}</span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="session.tags?.length" class="mb-6 flex gap-2 flex-wrap">
        <span v-for="tag in session.tags" :key="tag" class="text-xs bg-stone-700 text-stone-400 px-2 py-0.5 rounded">{{ tag }}</span>
      </div>

      <!-- Player Notes Section -->
      <div class="mt-8 border-t border-stone-700 pt-6">
        <h2 class="text-lg font-semibold text-amber-500 mb-4">📝 Player Notes</h2>

        <!-- Existing Notes -->
        <div v-if="visibleNotes.length === 0" class="text-stone-500 text-sm mb-4">No notes yet. Be the first to add one!</div>

        <div v-for="note in visibleNotes" :key="note.id" class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-3">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-amber-500 font-medium text-sm">{{ note.authorName }}</span>
              <span v-if="note.isPrivate" class="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">🔒 Private</span>
              <span class="text-stone-600 text-xs">{{ (note.createdAt as any)?.toDate ? new Date((note.createdAt as any).toDate()).toLocaleDateString() : '' }}</span>
            </div>
            <div v-if="canEditNote(note)" class="flex gap-2">
              <button @click="startEdit(note)" class="text-stone-500 hover:text-amber-500 text-xs">Edit</button>
              <button @click="deleteNote(note.id)" class="text-stone-500 hover:text-red-400 text-xs">Delete</button>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-if="editingNoteId === note.id">
            <textarea v-model="editContent" rows="3" class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none text-sm mb-2" />
            <div class="flex gap-2 justify-end">
              <button @click="cancelEdit" class="text-stone-400 hover:text-stone-200 text-sm px-3 py-1">Cancel</button>
              <button @click="saveEdit(note.id)" class="bg-amber-600 hover:bg-amber-500 text-stone-900 text-sm font-medium px-3 py-1 rounded">Save</button>
            </div>
          </div>

          <!-- Display mode -->
          <p v-else class="text-stone-300 text-sm whitespace-pre-wrap">{{ note.content }}</p>
        </div>

        <!-- Add Note Form -->
        <div v-if="auth.isAuthenticated" class="bg-stone-800/50 border border-stone-700 rounded-lg p-4 mt-4">
          <textarea v-model="newNoteContent" rows="3" placeholder="Write your notes about this session..." class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none text-sm mb-3" />
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-stone-400">
              <input v-model="newNotePrivate" type="checkbox" class="accent-amber-500" />
              🔒 Private (only you and DMs can see)
            </label>
            <button @click="addNote" :disabled="!newNoteContent.trim()" class="bg-amber-600 hover:bg-amber-500 text-stone-900 text-sm font-medium px-4 py-1.5 rounded transition-colors disabled:opacity-50">
              Add Note
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

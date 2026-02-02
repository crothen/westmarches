<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuthStore } from '../../stores/auth'
import MentionTextarea from './MentionTextarea.vue'
import MentionText from './MentionText.vue'

interface NoteReply {
  id: string
  userId: string
  authorName: string
  content: string
  deleted?: boolean
  createdAt: any
}

interface Note {
  id: string
  userId: string
  authorName: string
  content: string
  isPrivate: boolean
  deleted?: boolean
  replies: NoteReply[]
  createdAt: any
  updatedAt: any
}

const props = withDefaults(defineProps<{
  collectionName: string
  parentIdField: string
  parentIdValue: string
  orderDirection?: 'asc' | 'desc'
  title?: string
  /** Use 'card' for full-page views, 'card-flat' for side panels */
  variant?: 'compact' | 'full'
}>(), {
  orderDirection: 'desc',
  title: 'Notes',
  variant: 'compact',
})

const emit = defineEmits<{
  'notes-changed': []
}>()

const auth = useAuthStore()
const notes = ref<Note[]>([])
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const replyingTo = ref<string | null>(null)
const replyContent = ref('')
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')
let unsubNotes: (() => void) | null = null

const visibleNotes = computed(() => {
  return notes.value.filter(note => {
    if (!note.isPrivate) return true
    if (auth.isDm || auth.isAdmin) return true
    if (note.userId === auth.firebaseUser?.uid) return true
    return false
  })
})

const noteCardClass = computed(() =>
  props.variant === 'full'
    ? 'card p-4 mb-3 relative z-10'
    : 'card-flat !rounded-lg p-3 mb-2'
)

watch(() => props.parentIdValue, (newVal) => {
  unsubNotes?.()
  notes.value = []

  if (!newVal) return

  const notesQuery = query(
    collection(db, props.collectionName),
    where(props.parentIdField, '==', newVal),
    orderBy('createdAt', props.orderDirection)
  )

  unsubNotes = onSnapshot(notesQuery, (snap) => {
    notes.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Note))
  }, (err) => {
    console.warn(`Notes query error (${props.collectionName}):`, err.message)
  })
}, { immediate: true })

onUnmounted(() => {
  unsubNotes?.()
})

async function addNote() {
  if (!newNoteContent.value.trim() || !auth.firebaseUser || !props.parentIdValue) return
  await addDoc(collection(db, props.collectionName), {
    [props.parentIdField]: props.parentIdValue,
    userId: auth.firebaseUser.uid,
    authorName: auth.appUser?.displayName || 'Unknown',
    content: newNoteContent.value.trim(),
    isPrivate: newNotePrivate.value,
    replies: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  newNoteContent.value = ''
  newNotePrivate.value = false
  emit('notes-changed')
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
  await updateDoc(doc(db, props.collectionName, noteId), {
    replies: [...currentReplies, newReply],
    updatedAt: Timestamp.now()
  })
  replyContent.value = ''
  replyingTo.value = null
}

function startEditNote(note: Note) {
  editingNoteId.value = note.id
  editingNoteContent.value = note.content
}

function cancelEditNote() {
  editingNoteId.value = null
  editingNoteContent.value = ''
}

async function saveEditNote(noteId: string) {
  if (!editingNoteContent.value.trim()) return
  await updateDoc(doc(db, props.collectionName, noteId), {
    content: editingNoteContent.value.trim(),
    updatedAt: Timestamp.now()
  })
  editingNoteId.value = null
  editingNoteContent.value = ''
}

async function deleteNote(noteId: string) {
  if (!confirm('Delete this note?')) return
  await updateDoc(doc(db, props.collectionName, noteId), {
    content: '',
    deleted: true,
    deletedBy: auth.firebaseUser?.uid,
    updatedAt: Timestamp.now()
  })
  emit('notes-changed')
}

async function deleteReply(noteId: string, replyId: string) {
  const note = notes.value.find(n => n.id === noteId)
  if (!note) return
  const updatedReplies = (note.replies || []).map(r =>
    r.id === replyId ? { ...r, content: '', deleted: true } : r
  )
  await updateDoc(doc(db, props.collectionName, noteId), {
    replies: updatedReplies,
    updatedAt: Timestamp.now()
  })
}

function canEditNote(note: Note): boolean {
  return note.userId === auth.firebaseUser?.uid && !note.deleted
}

function canDeleteNote(note: Note): boolean {
  return (note.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !note.deleted
}

function canDeleteReply(reply: NoteReply): boolean {
  return (reply.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !reply.deleted
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div>
    <h4 v-if="title" :class="variant === 'full' ? 'text-lg font-semibold text-[#ef233c] mb-4' : 'text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3'" :style="variant === 'full' ? 'font-family: Manrope, sans-serif' : ''">{{ title }}</h4>

    <div v-if="visibleNotes.length === 0" class="text-zinc-700 text-sm mb-4">No notes yet.</div>

    <div v-for="note in visibleNotes" :key="note.id" :class="noteCardClass">
      <div :class="variant === 'full' ? 'relative z-10' : ''">
        <!-- Deleted placeholder -->
        <div v-if="note.deleted" class="text-zinc-600 text-xs italic">
          🗑️ This note was deleted
        </div>
        <template v-else>
          <!-- Note header -->
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <span class="text-[#ef233c] text-xs font-medium">{{ note.authorName }}</span>
              <span v-if="note.isPrivate" class="text-[0.6rem] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">🔒</span>
              <span class="text-zinc-600 text-[0.65rem]">{{ formatDate(note.createdAt) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button v-if="canEditNote(note)" @click="startEditNote(note)" class="text-zinc-500 hover:text-[#ef233c] text-xs transition-colors">Edit</button>
              <button v-if="canDeleteNote(note)" @click="deleteNote(note.id)" class="text-zinc-500 hover:text-red-400 text-xs transition-colors">Delete</button>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-if="editingNoteId === note.id" class="space-y-2">
            <MentionTextarea v-model="editingNoteContent" input-class="text-sm" :rows="2" />
            <div class="flex gap-2 justify-end">
              <button @click="cancelEditNote" class="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
              <button @click="saveEditNote(note.id)" class="btn !text-xs !py-1 !px-3">Save</button>
            </div>
          </div>
          <!-- Note content -->
          <p v-else class="text-zinc-300 text-sm whitespace-pre-wrap"><MentionText :text="note.content" /></p>

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
                <p class="text-zinc-400 text-sm"><MentionText :text="reply.content" /></p>
              </template>
            </div>
          </div>
        </template>

        <!-- Reply button / form -->
        <div v-if="auth.isAuthenticated && !note.deleted" class="mt-2">
          <button v-if="replyingTo !== note.id" @click="replyingTo = note.id" class="text-zinc-600 hover:text-[#ef233c] text-xs transition-colors">
            Reply
          </button>
          <div v-else class="mt-1.5">
            <MentionTextarea v-model="replyContent" :rows="2" placeholder="Write a reply..." input-class="text-sm !p-2" />
            <div class="flex gap-2 mt-1.5 justify-end">
              <button @click="replyingTo = null; replyContent = ''" class="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">Cancel</button>
              <button @click="addReply(note.id)" :disabled="!replyContent.trim()" class="btn !text-xs !py-1 !px-3">Reply</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Note Form -->
    <div v-if="auth.isAuthenticated && !auth.isGuest" :class="variant === 'full' ? 'card p-4 mt-4 relative z-10' : 'mt-3'">
      <div :class="variant === 'full' ? 'relative z-10' : ''">
        <MentionTextarea v-model="newNoteContent" :rows="2" placeholder="Add a note..." input-class="text-sm !p-2" />
        <div class="flex items-center justify-between mt-2">
          <label class="flex items-center gap-1.5 text-xs text-zinc-600">
            <input v-model="newNotePrivate" type="checkbox" class="accent-[#ef233c]" />
            🔒 Private
          </label>
          <button @click="addNote" :disabled="!newNoteContent.trim()" class="btn !text-xs !py-1 !px-3">Add Note</button>
        </div>
      </div>
    </div>
  </div>
</template>

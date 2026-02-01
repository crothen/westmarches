<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuthStore } from '../../stores/auth'
import type { HexNote } from '../../types'

const props = defineProps<{
  hex: { x: number; y: number } | null
  terrainConfig: Record<string, any>
  tagsConfig: Record<string, any>
  hexData: Record<string, any>
}>()

const emit = defineEmits<{
  close: []
  'update-terrain': [hexKey: string, terrainId: number]
  'toggle-tag': [hexKey: string, tagId: number]
  'set-main-tag': [hexKey: string, tagId: number | null, isPrivate: boolean]
}>()

const auth = useAuthStore()
const notes = ref<HexNote[]>([])
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const replyingTo = ref<string | null>(null)
const replyContent = ref('')
let unsubNotes: (() => void) | null = null

const hexKey = computed(() => props.hex ? `${props.hex.x}_${props.hex.y}` : null)

const currentHexData = computed(() => {
  if (!hexKey.value) return null
  return props.hexData[hexKey.value] || {}
})

const terrainName = computed(() => {
  if (!currentHexData.value?.type) return 'Unknown'
  const id = currentHexData.value.type
  for (const [name, conf] of Object.entries(props.terrainConfig)) {
    if ((conf as any).id === id) return name
  }
  return `Terrain ${id}`
})

const terrainOptions = computed(() => {
  return Object.entries(props.terrainConfig)
    .map(([name, conf]) => ({ name, id: (conf as any).id }))
    .sort((a, b) => a.id - b.id)
})

const tagOptions = computed(() => {
  return Object.entries(props.tagsConfig)
    .map(([name, conf]) => ({ name, id: (conf as any).id }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const currentMainTag = computed(() => {
  const tagId = currentHexData.value?.mainTag
  if (!tagId) return null
  for (const [name, conf] of Object.entries(props.tagsConfig)) {
    if ((conf as any).id === tagId) return name
  }
  return null
})

const currentSideTags = computed(() => {
  const tags = currentHexData.value?.tags || []
  return tags.map((tagId: number) => {
    for (const [name, conf] of Object.entries(props.tagsConfig)) {
      if ((conf as any).id === tagId) return name
    }
    return `Tag ${tagId}`
  })
})

const visibleNotes = computed(() => {
  return notes.value.filter(note => {
    if (!note.isPrivate) return true
    if (auth.isDm) return true
    if (note.userId === auth.firebaseUser?.uid) return true
    return false
  })
})

// Watch hex changes to subscribe to notes
watch(hexKey, (newKey) => {
  unsubNotes?.()
  notes.value = []
  
  if (!newKey) return
  
  const notesQuery = query(
    collection(db, 'hexNotes'),
    where('hexKey', '==', newKey),
    orderBy('createdAt', 'desc')
  )
  unsubNotes = onSnapshot(notesQuery, (snap) => {
    notes.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as HexNote))
  }, (err) => {
    console.warn('Hex notes query error:', err.message)
  })
}, { immediate: true })

onUnmounted(() => {
  unsubNotes?.()
})

function onTerrainChange(e: Event) {
  const terrainId = parseInt((e.target as HTMLSelectElement).value)
  if (hexKey.value && !isNaN(terrainId)) {
    emit('update-terrain', hexKey.value, terrainId)
  }
}

function onMainTagChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (!hexKey.value) return
  if (val === '') {
    emit('set-main-tag', hexKey.value, null, false)
  } else {
    emit('set-main-tag', hexKey.value, parseInt(val), false)
  }
}

function onToggleSideTag(tagId: number) {
  if (hexKey.value) {
    emit('toggle-tag', hexKey.value, tagId)
  }
}

async function addNote() {
  if (!newNoteContent.value.trim() || !auth.firebaseUser || !hexKey.value) return
  await addDoc(collection(db, 'hexNotes'), {
    hexKey: hexKey.value,
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
  await updateDoc(doc(db, 'hexNotes', noteId), {
    replies: [...currentReplies, newReply],
    updatedAt: Timestamp.now()
  })
  replyContent.value = ''
  replyingTo.value = null
}

async function deleteNote(noteId: string) {
  if (!confirm('Delete this note and all replies?')) return
  await deleteDoc(doc(db, 'hexNotes', noteId))
}

function canDelete(note: HexNote): boolean {
  return note.userId === auth.firebaseUser?.uid || auth.isDm
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div v-if="hex" class="w-80 lg:w-96 min-h-[calc(100vh-3.5rem)] border-l border-white/[0.06] bg-[var(--bg-secondary)]/80 backdrop-blur-xl overflow-y-auto">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-[var(--bg-secondary)]/90 backdrop-blur-xl border-b border-white/[0.06] p-4 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold text-slate-100">Hex {{ hex.x }}, {{ hex.y }}</h3>
        <p class="text-xs text-slate-500">{{ terrainName }}</p>
      </div>
      <button @click="emit('close')" class="text-slate-500 hover:text-slate-300 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <div class="p-4 space-y-5">
      <!-- Tags info (visible to all) -->
      <div v-if="currentMainTag || currentSideTags.length > 0">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tags</h4>
        <div class="flex flex-wrap gap-1.5">
          <span v-if="currentMainTag" class="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">{{ currentMainTag }}</span>
          <span v-for="tag in currentSideTags" :key="tag" class="text-xs bg-white/5 text-slate-400 px-2 py-0.5 rounded-full">{{ tag }}</span>
        </div>
      </div>

      <!-- DM Edit Section -->
      <div v-if="auth.isDm" class="glass-card !rounded-lg p-3 space-y-3">
        <h4 class="text-xs font-semibold text-amber-500 uppercase tracking-wider">DM Tools</h4>
        
        <!-- Terrain picker -->
        <div>
          <label class="block text-xs text-slate-500 mb-1">Terrain</label>
          <select :value="currentHexData?.type || 1" @change="onTerrainChange" class="modern-input w-full text-sm">
            <option v-for="t in terrainOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <!-- Main tag picker -->
        <div>
          <label class="block text-xs text-slate-500 mb-1">Main Tag</label>
          <select :value="currentHexData?.mainTag || ''" @change="onMainTagChange" class="modern-input w-full text-sm">
            <option value="">None</option>
            <option v-for="t in tagOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <!-- Side tags -->
        <div>
          <label class="block text-xs text-slate-500 mb-1">Side Tags (max 6)</label>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="t in tagOptions" :key="t.id"
              @click="onToggleSideTag(t.id)"
              :class="[
                'text-xs px-2 py-0.5 rounded-full transition-colors',
                (currentHexData?.tags || []).includes(t.id) ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-500 hover:text-slate-300'
              ]"
            >{{ t.name }}</button>
          </div>
        </div>
      </div>

      <!-- Notes Section -->
      <div>
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Notes</h4>
        
        <div v-if="visibleNotes.length === 0" class="text-slate-600 text-sm">No notes on this hex yet.</div>

        <div v-for="note in visibleNotes" :key="note.id" class="glass-card !rounded-lg p-3 mb-2">
          <!-- Note header -->
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <span class="text-amber-500 text-xs font-medium">{{ note.authorName }}</span>
              <span v-if="note.isPrivate" class="text-[0.6rem] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">🔒</span>
              <span class="text-slate-600 text-[0.65rem]">{{ formatDate(note.createdAt) }}</span>
            </div>
            <button v-if="canDelete(note)" @click="deleteNote(note.id)" class="text-slate-600 hover:text-red-400 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>

          <!-- Note content -->
          <p class="text-slate-300 text-sm whitespace-pre-wrap">{{ note.content }}</p>

          <!-- Replies -->
          <div v-if="note.replies?.length" class="mt-2 pl-3 border-l border-white/[0.06] space-y-2">
            <div v-for="reply in note.replies" :key="reply.id" class="text-sm">
              <div class="flex items-center gap-1.5">
                <span class="text-amber-500/80 text-xs font-medium">{{ reply.authorName }}</span>
                <span class="text-slate-600 text-[0.65rem]">{{ formatDate(reply.createdAt) }}</span>
              </div>
              <p class="text-slate-400 text-sm">{{ reply.content }}</p>
            </div>
          </div>

          <!-- Reply button / form -->
          <div class="mt-2">
            <button v-if="replyingTo !== note.id" @click="replyingTo = note.id" class="text-slate-500 hover:text-amber-500 text-xs transition-colors">
              Reply
            </button>
            <div v-else class="mt-1.5">
              <textarea v-model="replyContent" rows="2" placeholder="Write a reply..." class="modern-input w-full text-sm !p-2" />
              <div class="flex gap-2 mt-1.5 justify-end">
                <button @click="replyingTo = null; replyContent = ''" class="text-slate-500 hover:text-slate-300 text-xs transition-colors">Cancel</button>
                <button @click="addReply(note.id)" :disabled="!replyContent.trim()" class="btn-primary !text-xs !py-1 !px-3">Reply</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Note Form -->
        <div v-if="auth.isAuthenticated" class="mt-3">
          <textarea v-model="newNoteContent" rows="2" placeholder="Add a note to this hex..." class="modern-input w-full text-sm !p-2" />
          <div class="flex items-center justify-between mt-2">
            <label class="flex items-center gap-1.5 text-xs text-slate-500">
              <input v-model="newNotePrivate" type="checkbox" class="accent-amber-500" />
              🔒 Private
            </label>
            <button @click="addNote" :disabled="!newNoteContent.trim()" class="btn-primary !text-xs !py-1 !px-3">Add Note</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

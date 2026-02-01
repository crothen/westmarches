<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp, getDocs } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../../firebase/config'
import { useAuthStore } from '../../stores/auth'
import DetailMapViewer from './DetailMapViewer.vue'
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
  'update-detail-map': [hexKey: string, url: string | null]
}>()

const auth = useAuthStore()
const notes = ref<HexNote[]>([])
const newNoteContent = ref('')
const newNotePrivate = ref(false)
const replyingTo = ref<string | null>(null)
const replyContent = ref('')
let unsubNotes: (() => void) | null = null
const uploadProgress = ref(0)
const isUploading = ref(false)
const showDetailMapViewer = ref(false)
const hexLocations = ref<any[]>([])
const hexFeatures = ref<any[]>([])

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

watch(hexKey, async (newKey) => {
  hexLocations.value = []
  hexFeatures.value = []
  if (!newKey) return
  
  try {
    const [locSnap, featSnap] = await Promise.all([
      getDocs(query(collection(db, 'locations'), where('hexKey', '==', newKey))),
      getDocs(query(collection(db, 'features'), where('hexKey', '==', newKey)))
    ])
    hexLocations.value = locSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    hexFeatures.value = featSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.warn('Failed to load hex locations:', e)
  }
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

// Edit note
const editingHexNoteId = ref<string | null>(null)
const editingHexNoteContent = ref('')

function startEditHexNote(note: HexNote) {
  editingHexNoteId.value = note.id
  editingHexNoteContent.value = note.content
}

function cancelEditHexNote() {
  editingHexNoteId.value = null
  editingHexNoteContent.value = ''
}

async function saveEditHexNote(noteId: string) {
  if (!editingHexNoteContent.value.trim()) return
  await updateDoc(doc(db, 'hexNotes', noteId), {
    content: editingHexNoteContent.value.trim(),
    updatedAt: Timestamp.now()
  })
  editingHexNoteId.value = null
  editingHexNoteContent.value = ''
}

async function deleteNote(noteId: string) {
  if (!confirm('Delete this note?')) return
  // Soft delete
  await updateDoc(doc(db, 'hexNotes', noteId), {
    content: '',
    deleted: true,
    deletedBy: auth.firebaseUser?.uid,
    updatedAt: Timestamp.now()
  })
}

async function deleteReply(noteId: string, replyId: string) {
  const note = notes.value.find(n => n.id === noteId)
  if (!note) return
  const updatedReplies = (note.replies || []).map(r =>
    r.id === replyId ? { ...r, content: '', deleted: true } : r
  )
  await updateDoc(doc(db, 'hexNotes', noteId), {
    replies: updatedReplies,
    updatedAt: Timestamp.now()
  })
}

function canEditNote(note: HexNote): boolean {
  return note.userId === auth.firebaseUser?.uid && !(note as any).deleted
}

function canDelete(note: HexNote): boolean {
  return (note.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !(note as any).deleted
}

function canDeleteReply(reply: any): boolean {
  return (reply.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin) && !reply.deleted
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const detailMapUrl = computed(() => currentHexData.value?.detailMapUrl || null)

async function uploadDetailMap(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !hexKey.value) return

  isUploading.value = true
  uploadProgress.value = 0

  const ext = file.name.split('.').pop() || 'png'
  const fileRef = storageRef(storage, `detail-maps/${hexKey.value}/map.${ext}`)
  const uploadTask = uploadBytesResumable(fileRef, file)

  uploadTask.on('state_changed',
    (snapshot) => {
      uploadProgress.value = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
    },
    (error) => {
      console.error('Upload failed:', error)
      isUploading.value = false
    },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      emit('update-detail-map', hexKey.value!, url)
      isUploading.value = false
      uploadProgress.value = 0
    }
  )
}

async function removeDetailMap() {
  if (!hexKey.value || !confirm('Remove the detail map?')) return
  try {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
      try {
        const fileRef = storageRef(storage, `detail-maps/${hexKey.value}/map.${ext}`)
        await deleteObject(fileRef)
        break
      } catch { /* try next */ }
    }
  } catch { /* storage cleanup is best-effort */ }
  emit('update-detail-map', hexKey.value!, null)
}
</script>

<template>
  <div v-if="hex" class="w-80 lg:w-96 min-h-[calc(100vh-5rem)] border-l border-white/[0.06] bg-black/80 backdrop-blur-xl overflow-y-auto">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/[0.06] p-4 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold text-zinc-100" style="font-family: Manrope, sans-serif">Hex {{ hex.x }}, {{ hex.y }}</h3>
        <p class="text-xs text-zinc-600">{{ terrainName }}</p>
      </div>
      <button @click="emit('close')" class="text-zinc-600 hover:text-zinc-300 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <div class="p-4 space-y-5">
      <!-- Tags info (visible to all) -->
      <div v-if="currentMainTag || currentSideTags.length > 0">
        <h4 class="label mb-2">Tags</h4>
        <div class="flex flex-wrap gap-1.5">
          <span v-if="currentMainTag" class="text-xs bg-[#ef233c]/15 text-[#ef233c] px-2 py-0.5 rounded-full">{{ currentMainTag }}</span>
          <span v-for="tag in currentSideTags" :key="tag" class="text-xs bg-white/5 text-zinc-500 px-2 py-0.5 rounded-full">{{ tag }}</span>
        </div>
      </div>

      <!-- Locations in this hex -->
      <div v-if="hexLocations.length > 0 || hexFeatures.length > 0">
        <h4 class="label mb-2">Locations</h4>
        <div class="space-y-1.5">
          <RouterLink
            v-for="loc in hexLocations" :key="loc.id"
            :to="`/locations/${loc.id}`"
            class="block card-flat p-2.5 hover:border-white/20 transition-colors"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm">🏰</span>
              <span class="text-sm text-zinc-200 font-medium">{{ loc.name }}</span>
              <span class="text-[0.6rem] text-zinc-600">{{ loc.type }}</span>
            </div>
          </RouterLink>
          <div v-for="feat in hexFeatures" :key="feat.id" class="card-flat p-2.5">
            <div class="flex items-center gap-2">
              <span class="text-sm">📌</span>
              <span class="text-sm text-zinc-300">{{ feat.name }}</span>
              <span class="text-[0.6rem] text-zinc-600">{{ feat.type }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- DM Edit Section -->
      <div v-if="auth.isDm" class="card-flat !rounded-lg p-3 space-y-3">
        <h4 class="label text-[#ef233c]">DM Tools</h4>
        
        <!-- Terrain picker -->
        <div>
          <label class="block text-xs text-zinc-600 mb-1">Terrain</label>
          <select :value="currentHexData?.type || 1" @change="onTerrainChange" class="input w-full text-sm">
            <option v-for="t in terrainOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <!-- Main tag picker -->
        <div>
          <label class="block text-xs text-zinc-600 mb-1">Main Tag</label>
          <select :value="currentHexData?.mainTag || ''" @change="onMainTagChange" class="input w-full text-sm">
            <option value="">None</option>
            <option v-for="t in tagOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <!-- Side tags -->
        <div>
          <label class="block text-xs text-zinc-600 mb-1">Side Tags (max 6)</label>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="t in tagOptions" :key="t.id"
              @click="onToggleSideTag(t.id)"
              :class="[
                'text-xs px-2 py-0.5 rounded-full transition-colors',
                (currentHexData?.tags || []).includes(t.id) ? 'bg-[#ef233c]/20 text-[#ef233c]' : 'bg-white/5 text-zinc-600 hover:text-zinc-300'
              ]"
            >{{ t.name }}</button>
          </div>
        </div>

        <!-- Detail Map -->
        <div class="mt-3">
          <label class="block text-xs text-zinc-500 mb-1">Detail Map</label>
          <div v-if="detailMapUrl" class="mb-2">
            <img :src="detailMapUrl" class="w-full rounded-lg border border-white/10 cursor-pointer hover:border-white/20 transition-colors" @click="showDetailMapViewer = true" />
            <button @click="removeDetailMap" class="text-xs text-zinc-600 hover:text-red-400 mt-1 transition-colors">Remove map</button>
          </div>
          <div v-if="isUploading" class="mb-2">
            <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div class="h-full bg-[#ef233c] rounded-full transition-all duration-300" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <span class="text-xs text-zinc-500 mt-1">{{ uploadProgress }}%</span>
          </div>
          <input v-if="!isUploading" type="file" accept="image/*" @change="uploadDetailMap" class="text-xs text-zinc-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:text-zinc-400 file:text-xs file:cursor-pointer hover:file:bg-white/10 file:transition-colors" />
        </div>
      </div>

      <!-- Detail Map Preview (visible to non-DMs) -->
      <div v-if="detailMapUrl && !auth.isDm">
        <h4 class="label mb-2">Detail Map</h4>
        <img :src="detailMapUrl" class="w-full rounded-lg border border-white/10 cursor-pointer hover:border-white/20 transition-colors" @click="showDetailMapViewer = true" />
      </div>

      <!-- Notes Section -->
      <div>
        <h4 class="label mb-3">Notes</h4>
        
        <div v-if="visibleNotes.length === 0" class="text-zinc-700 text-sm">No notes on this hex yet.</div>

        <div v-for="note in visibleNotes" :key="note.id" class="card-flat !rounded-lg p-3 mb-2">
          <!-- Deleted placeholder -->
          <div v-if="(note as any).deleted" class="text-zinc-600 text-xs italic">
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
                <button v-if="canEditNote(note)" @click="startEditHexNote(note)" class="text-zinc-500 hover:text-[#ef233c] text-xs transition-colors">Edit</button>
                <button v-if="canDelete(note)" @click="deleteNote(note.id)" class="text-zinc-500 hover:text-red-400 text-xs transition-colors">Delete</button>
              </div>
            </div>

            <!-- Edit mode -->
            <div v-if="editingHexNoteId === note.id" class="space-y-2">
              <textarea v-model="editingHexNoteContent" class="input w-full text-sm" rows="2" />
              <div class="flex gap-2 justify-end">
                <button @click="cancelEditHexNote" class="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                <button @click="saveEditHexNote(note.id)" class="btn !text-xs !py-1 !px-3">Save</button>
              </div>
            </div>
            <!-- Note content -->
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
          </template>

          <!-- Reply button / form -->
          <div class="mt-2">
            <button v-if="replyingTo !== note.id" @click="replyingTo = note.id" class="text-zinc-600 hover:text-[#ef233c] text-xs transition-colors">
              Reply
            </button>
            <div v-else class="mt-1.5">
              <textarea v-model="replyContent" rows="2" placeholder="Write a reply..." class="input w-full text-sm !p-2" />
              <div class="flex gap-2 mt-1.5 justify-end">
                <button @click="replyingTo = null; replyContent = ''" class="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">Cancel</button>
                <button @click="addReply(note.id)" :disabled="!replyContent.trim()" class="btn !text-xs !py-1 !px-3">Reply</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Note Form -->
        <div v-if="auth.isAuthenticated" class="mt-3">
          <textarea v-model="newNoteContent" rows="2" placeholder="Add a note to this hex..." class="input w-full text-sm !p-2" />
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

    <!-- Detail Map Viewer Modal -->
    <DetailMapViewer
      v-if="showDetailMapViewer && detailMapUrl"
      :image-url="detailMapUrl"
      :hex-label="`Hex ${hex.x}, ${hex.y}`"
      @close="showDetailMapViewer = false"
    />
  </div>
</template>

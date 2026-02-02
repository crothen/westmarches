<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import SessionForm from '../components/sessions/SessionForm.vue'
import SessionTimeline from '../components/sessions/SessionTimeline.vue'
import type { SessionLog, SessionNote, Character, Npc } from '../types'

const route = useRoute()
const auth = useAuthStore()
const { generating: genLoading, error: genError, generateImageRaw, uploadImageData, cropToAspectRatio } = useImageGen()
const session = ref<SessionLog | null>(null)

// Art generation modal state (unified generate → crop flow)
const CROP_RATIO = 3 // width:height ratio for session art banner
const showArtModal = ref(false)
const artModalPhase = ref<'generating' | 'cropping'>('generating')
const rawImageData = ref<{ data: Uint8Array; mimeType: string; objectUrl: string } | null>(null)
const cropPosition = ref(0.5) // 0=top, 0.5=center, 1=bottom
const savingCrop = ref(false)
const rawImageDimensions = ref<{ width: number; height: number }>({ width: 1, height: 1 })

// Drag state for crop
const isDraggingCrop = ref(false)
const dragStartY = ref(0)
const dragStartPosition = ref(0)
const cropContainerRef = ref<HTMLElement | null>(null)

// Compute crop overlay percentages
const cropOverlayTop = computed(() => {
  const { width, height } = rawImageDimensions.value
  if (!height) return 0
  const cropH = width / CROP_RATIO
  const maxY = height - cropH
  const cropY = cropPosition.value * maxY
  return (cropY / height) * 100
})
const cropOverlayBottom = computed(() => {
  const { width, height } = rawImageDimensions.value
  if (!height) return 0
  const cropH = width / CROP_RATIO
  const maxY = height - cropH
  const cropY = cropPosition.value * maxY
  return ((height - cropY - cropH) / height) * 100
})

function onCropDragStart(e: MouseEvent | TouchEvent) {
  isDraggingCrop.value = true
  dragStartY.value = 'touches' in e ? e.touches[0]!.clientY : e.clientY
  dragStartPosition.value = cropPosition.value
  e.preventDefault()
}

function onCropDragMove(e: MouseEvent | TouchEvent) {
  if (!isDraggingCrop.value || !cropContainerRef.value) return
  const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY
  const containerH = cropContainerRef.value.clientHeight
  const deltaY = clientY - dragStartY.value
  // Moving mouse down = moving crop down = increasing position
  const deltaPct = deltaY / containerH
  const newPos = Math.max(0, Math.min(1, dragStartPosition.value + deltaPct))
  cropPosition.value = newPos
}

function onCropDragEnd() {
  isDraggingCrop.value = false
}
const notes = ref<SessionNote[]>([])
const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const newNoteContent = ref('')

// Image generation state
const showPromptEditor = ref(false)
const editablePrompt = ref('')

// Character & NPC lookup for image gen appearances
const characters = ref<Character[]>([])
const npcList = ref<Npc[]>([])

// NPC name lookup
const npcNames = ref<Record<string, string>>({})
const editingNoteId = ref<string | null>(null)
const editContent = ref('')
const replyingTo = ref<string | null>(null)
const replyContent = ref('')
const _unsubs: (() => void)[] = []

const sessionId = computed(() => route.params.id as string)
const canEdit = computed(() => auth.isDm || auth.isAdmin)

const visibleNotes = computed(() => {
  return notes.value.filter(note => {
    if (!note.isPrivate) return true
    if (auth.isDm) return true
    if (note.userId === auth.firebaseUser?.uid) return true
    return false
  })
})

onMounted(async () => {
  // Listen to session document in real-time
  _unsubs.push(onSnapshot(doc(db, 'sessions', sessionId.value), (snap) => {
    if (snap.exists()) {
      session.value = { id: snap.id, ...snap.data() } as SessionLog
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load session:', e)
    loading.value = false
  }))

  const notesQuery = query(
    collection(db, 'sessionNotes'),
    where('sessionId', '==', sessionId.value),
    orderBy('createdAt', 'asc')
  )
  _unsubs.push(onSnapshot(notesQuery, (snap) => {
    notes.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionNote))
  }, (err) => {
    console.warn('Notes query error (index may need creating):', err.message)
  }))

  // Load NPC names for display + appearance data for image gen
  _unsubs.push(onSnapshot(collection(db, 'npcs'), (snap) => {
    const names: Record<string, string> = {}
    npcList.value = snap.docs.map(d => {
      const data = d.data()
      names[d.id] = data.name || d.id
      return { id: d.id, ...data } as Npc
    })
    npcNames.value = names
  }))

  // Load characters for appearance data in image gen
  _unsubs.push(onSnapshot(collection(db, 'characters'), (snap) => {
    characters.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
  }))
})

onUnmounted(() => {
  _unsubs.forEach(fn => fn())
})

async function handleEdit(data: Partial<SessionLog>) {
  if (!session.value) return
  saving.value = true
  try {
    await updateDoc(doc(db, 'sessions', session.value.id), {
      ...data,
      date: Timestamp.fromDate(new Date(data.date as any)),
      updatedAt: Timestamp.now(),
    })
    editing.value = false
  } catch (e) {
    console.error('Failed to update session:', e)
    alert('Failed to save changes.')
  } finally {
    saving.value = false
  }
}

async function addNote() {
  if (!newNoteContent.value.trim() || !auth.firebaseUser) return
  await addDoc(collection(db, 'sessionNotes'), {
    sessionId: sessionId.value,
    userId: auth.firebaseUser.uid,
    authorName: auth.appUser?.displayName || 'Unknown',
    content: newNoteContent.value.trim(),
    isPrivate: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  newNoteContent.value = ''
}

function startNoteEdit(note: SessionNote) {
  editingNoteId.value = note.id
  editContent.value = note.content
}

function cancelNoteEdit() {
  editingNoteId.value = null
  editContent.value = ''
}

async function saveNoteEdit(noteId: string) {
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

function buildSessionPrompt(): string {
  if (!session.value) return ''
  // Build character descriptions with appearances when available
  const charDescriptions = (session.value.participants || []).map(p => {
    const char = characters.value.find(c => c.id === p.characterId)
    if (char?.appearance) {
      return `${p.characterName} (${char.race || ''} ${char.class || ''} — ${char.appearance})`.replace(/\(\s+/, '(')
    }
    return p.characterName
  })
  const participants = charDescriptions.join('; ') || 'adventurers'

  // Include NPC appearances if any encountered
  let npcStr = ''
  if (session.value.npcsEncountered?.length) {
    const npcDescriptions = session.value.npcsEncountered.map(id => {
      const npc = npcList.value.find(n => n.id === id)
      if (!npc) return null
      if (npc.appearance) return `${npc.name} (${npc.race || ''} — ${npc.appearance})`.replace(/\(\s+/, '(')
      return npc.name
    }).filter(Boolean)
    if (npcDescriptions.length) npcStr = ` NPCs present: ${npcDescriptions.join('; ')}.`
  }

  return `Create a dramatic D&D fantasy scene illustration with a wide panoramic composition. Session title: "${session.value.title}". Summary: ${session.value.summary?.substring(0, 500)}. Characters involved: ${participants}.${npcStr} Style: epic fantasy art, dramatic lighting, painterly, wide landscape composition, medieval fantasy setting. Keep the main subject centered — the image will be cropped to a wide banner.`
}

function openPromptEditor() {
  editablePrompt.value = buildSessionPrompt()
  showPromptEditor.value = true
}

async function generateSessionArt() {
  if (!session.value) return
  const prompt = showPromptEditor.value ? editablePrompt.value : buildSessionPrompt()
  showPromptEditor.value = false

  // Open modal immediately in generating phase
  showArtModal.value = true
  artModalPhase.value = 'generating'

  // Clean up previous preview
  if (rawImageData.value) URL.revokeObjectURL(rawImageData.value.objectUrl)
  rawImageData.value = null

  const result = await generateImageRaw(prompt)
  if (result) {
    rawImageData.value = result
    cropPosition.value = 0.5
    // Load dimensions then show crop
    const img = new Image()
    img.onload = () => {
      rawImageDimensions.value = { width: img.naturalWidth, height: img.naturalHeight }
      artModalPhase.value = 'cropping'
    }
    img.src = result.objectUrl
  } else {
    // Generation failed — close modal (error shown via genError)
    showArtModal.value = false
  }
}

async function confirmCrop() {
  if (!session.value || !rawImageData.value) return
  savingCrop.value = true
  try {
    const croppedBlob = await cropToAspectRatio(
      rawImageData.value.data, rawImageData.value.mimeType, CROP_RATIO, cropPosition.value
    )
    const url = await uploadImageData(croppedBlob, 'image/png', `session-art/${session.value.id}`)
    await updateDoc(doc(db, 'sessions', session.value.id), { imageUrl: url })
    closeArtModal()
  } catch (e) {
    console.error('Crop failed:', e)
  } finally {
    savingCrop.value = false
  }
}

function closeArtModal() {
  showArtModal.value = false
  if (rawImageData.value) {
    URL.revokeObjectURL(rawImageData.value.objectUrl)
    rawImageData.value = null
  }
}

async function removeSessionArt() {
  if (!session.value || !confirm('Remove the session image?')) return
  await updateDoc(doc(db, 'sessions', session.value.id), { imageUrl: null })
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
      <!-- Edit mode -->
      <div v-if="editing" class="card-flat p-5 mb-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-4" style="font-family: Manrope, sans-serif">✏️ Edit Session</h2>
        <SessionForm
          :session="session"
          @submit="handleEdit"
          @cancel="editing = false"
        />
      </div>

      <!-- View mode -->
      <template v-else>
        <div class="flex items-center gap-3 mb-2">
          <span class="text-[#ef233c] font-bold text-2xl" style="font-family: Manrope, sans-serif">Session {{ session.sessionNumber }}</span>
          <span class="text-zinc-600">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
          <span v-if="session.sessionLocationName" class="text-zinc-600 text-sm">📍 {{ session.sessionLocationName }}</span>
          <button
            v-if="canEdit"
            @click="editing = true"
            class="btn !text-xs !py-1.5 !px-3 ml-auto"
          >
            ✏️ Edit
          </button>
        </div>
        <h1 class="text-3xl font-bold text-white mb-6" style="font-family: Manrope, sans-serif">{{ session.title }}</h1>

        <!-- Session Art -->
        <div v-if="(session as any).imageUrl" class="mb-6 -mx-1 relative group">
          <img :src="(session as any).imageUrl" class="w-full max-h-80 object-contain rounded-xl border border-white/10 mx-auto" />
          <div v-if="canEdit" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
            <button @click="openPromptEditor" class="bg-black/70 backdrop-blur text-zinc-300 hover:text-white text-xs px-2.5 py-1.5 rounded-lg border border-white/10 transition-colors">🎨 Regenerate</button>
            <button @click="removeSessionArt" class="bg-black/70 backdrop-blur text-red-400 hover:text-red-300 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 transition-colors">✕ Remove</button>
          </div>
        </div>

        <!-- Generate / Prompt editor -->
        <div v-if="!(session as any).imageUrl || showPromptEditor" class="mb-6">
          <div v-if="showPromptEditor" class="card-flat p-4 space-y-3">
            <label class="text-sm font-semibold text-zinc-400">Image Prompt</label>
            <textarea v-model="editablePrompt" rows="5" class="input w-full text-sm" />
            <div class="flex gap-2">
              <button @click="generateSessionArt" :disabled="genLoading" class="btn !text-xs !py-1.5">
                {{ genLoading ? '🎨 Generating...' : '🎨 Generate' }}
              </button>
              <button @click="showPromptEditor = false" class="btn !bg-white/5 !text-zinc-400 !text-xs !py-1.5">Cancel</button>
            </div>
          </div>
          <div v-else-if="!(session as any).imageUrl" class="flex gap-2">
            <button
              v-if="auth.isAuthenticated"
              @click="generateSessionArt"
              :disabled="genLoading"
              class="btn !text-xs !py-1.5 !px-3"
            >
              {{ genLoading ? '🎨 Generating...' : '🎨 Generate Scene Art' }}
            </button>
            <button
              v-if="canEdit"
              @click="openPromptEditor"
              class="btn !bg-white/5 !text-zinc-400 !text-xs !py-1.5 !px-3"
            >
              ✏️ Edit Prompt
            </button>
          </div>
        </div>
        <div v-if="genError" class="text-red-400 text-xs mb-4">{{ genError }}</div>

        <!-- Participants -->
        <div v-if="session.participants?.length" class="mb-6">
          <h2 class="text-lg font-semibold text-[#ef233c] mb-2" style="font-family: Manrope, sans-serif">🧙 Adventurers</h2>
          <div class="flex flex-wrap gap-2">
            <RouterLink
              v-for="p in session.participants" :key="p.characterId"
              :to="`/characters/${p.characterId}`"
              class="bg-white/[0.05] border border-white/[0.06] text-zinc-200 px-3 py-1 rounded-lg text-sm hover:border-[#ef233c]/30 hover:text-[#ef233c] transition-colors"
            >
              {{ p.characterName }}
            </RouterLink>
          </div>
        </div>

        <!-- NPCs Encountered -->
        <div v-if="session.npcsEncountered?.length" class="mb-6">
          <h2 class="text-lg font-semibold text-[#ef233c] mb-2" style="font-family: Manrope, sans-serif">👤 NPCs Encountered</h2>
          <div class="flex flex-wrap gap-2">
            <RouterLink
              v-for="npcId in session.npcsEncountered" :key="npcId"
              :to="`/npcs/${npcId}`"
              class="bg-white/[0.05] border border-white/[0.06] text-zinc-200 px-3 py-1 rounded-lg text-sm hover:border-[#ef233c]/30 hover:text-[#ef233c] transition-colors"
            >
              {{ npcNames[npcId] || npcId }}
            </RouterLink>
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
      </template>

      <!-- Session Timeline -->
      <SessionTimeline
        :session-id="sessionId"
        :session-participants="session?.participants"
      />

      <!-- Session Comments Section -->
      <div class="mt-8 border-t border-white/[0.06] pt-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-4" style="font-family: Manrope, sans-serif">💬 Session Comments</h2>

        <div v-if="visibleNotes.length === 0" class="text-zinc-600 text-sm mb-4">No comments yet. Be the first to add one!</div>

        <div v-for="note in visibleNotes" :key="note.id" class="card p-4 mb-3 relative z-10">
          <div class="relative z-10">
            <!-- Deleted placeholder -->
            <div v-if="(note as any).deleted" class="text-zinc-600 text-sm italic">
              🗑️ This comment was deleted
            </div>
            <template v-else>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-[#ef233c] font-medium text-sm">{{ note.authorName }}</span>
                  <span class="text-zinc-600 text-xs">{{ (note.createdAt as any)?.toDate ? new Date((note.createdAt as any).toDate()).toLocaleDateString() : '' }}</span>
                </div>
                <div class="flex gap-2">
                  <button v-if="canEditNote(note)" @click="startNoteEdit(note)" class="text-zinc-500 hover:text-[#ef233c] text-xs transition-colors">Edit</button>
                  <button v-if="canDeleteNote(note)" @click="deleteNote(note.id)" class="text-zinc-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                </div>
              </div>

              <!-- Edit mode -->
              <div v-if="editingNoteId === note.id">
                <textarea v-model="editContent" rows="3" class="input w-full text-sm mb-2" />
                <div class="flex gap-2 justify-end">
                  <button @click="cancelNoteEdit" class="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
                  <button @click="saveNoteEdit(note.id)" class="btn text-sm !py-1 !px-3">Save</button>
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

        <!-- Add Comment Form -->
        <div v-if="auth.isAuthenticated" class="card p-4 mt-4 relative z-10">
          <div class="relative z-10">
            <textarea v-model="newNoteContent" rows="3" placeholder="Share your thoughts about this session..." class="input w-full text-sm mb-3" />
            <div class="flex items-center justify-end">
              <button @click="addNote" :disabled="!newNoteContent.trim()" class="btn text-sm">
                Add Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Art Generation & Crop Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showArtModal" class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @mousemove="onCropDragMove" @mouseup="onCropDragEnd"
          @touchmove.prevent="onCropDragMove" @touchend="onCropDragEnd"
        >
          <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="artModalPhase === 'cropping' ? closeArtModal() : undefined" />
          <div class="relative w-full max-w-3xl bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between p-5 pb-3">
              <h3 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">
                {{ artModalPhase === 'generating' ? '🎨 Generating Scene Art...' : '🖼️ Adjust Crop' }}
              </h3>
              <button @click="closeArtModal" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <!-- Generating phase: spinner -->
            <div v-if="artModalPhase === 'generating'" class="flex flex-col items-center justify-center py-20 px-6">
              <svg class="animate-spin h-12 w-12 text-[#ef233c] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-zinc-400 text-sm">Generating your scene art with AI...</p>
              <p class="text-zinc-600 text-xs mt-1">This takes ~10-20 seconds</p>
            </div>

            <!-- Cropping phase: draggable image -->
            <template v-if="artModalPhase === 'cropping' && rawImageData">
              <p class="text-zinc-500 text-xs px-5 mb-2">Drag the image up or down to adjust the crop area</p>
              <!-- Crop viewport -->
              <div
                ref="cropContainerRef"
                class="relative mx-5 overflow-hidden rounded-xl border border-white/10 select-none"
                :class="isDraggingCrop ? 'cursor-grabbing' : 'cursor-grab'"
                @mousedown="onCropDragStart"
                @touchstart.prevent="onCropDragStart"
              >
                <img :src="rawImageData.objectUrl" class="w-full pointer-events-none" draggable="false" />
                <!-- Darkened areas outside crop -->
                <div class="absolute inset-0 pointer-events-none">
                  <div class="absolute top-0 left-0 right-0 bg-black/65 transition-all duration-75" :style="{ height: `${cropOverlayTop}%` }" />
                  <div class="absolute bottom-0 left-0 right-0 bg-black/65 transition-all duration-75" :style="{ height: `${cropOverlayBottom}%` }" />
                  <!-- Crop frame -->
                  <div class="absolute left-0 right-0 border-y-2 border-[#ef233c]/70 transition-all duration-75" :style="{ top: `${cropOverlayTop}%`, bottom: `${cropOverlayBottom}%` }">
                    <!-- Drag handle lines -->
                    <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
                      <div class="flex flex-col gap-0.5 opacity-50">
                        <div class="w-8 h-0.5 bg-white rounded-full" />
                        <div class="w-8 h-0.5 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex justify-end gap-2 p-5 pt-4">
                <button @click="closeArtModal" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
                <button @click="confirmCrop" :disabled="savingCrop" class="btn text-sm">
                  {{ savingCrop ? '💾 Saving...' : '✅ Use This Crop' }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

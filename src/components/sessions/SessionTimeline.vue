<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuthStore } from '../../stores/auth'
import MentionText from '../common/MentionText.vue'
import SessionEntryForm from './SessionEntryForm.vue'
import type { SessionEntry, SessionEntryType, SessionParticipant, Npc, CampaignLocation, LocationFeature, EntryComment } from '../../types'

const props = defineProps<{
  sessionId: string
  sessionParticipants?: SessionParticipant[]
}>()

const auth = useAuthStore()
const entries = ref<SessionEntry[]>([])
const npcs = ref<Npc[]>([])
const locations = ref<CampaignLocation[]>([])
const features = ref<LocationFeature[]>([])

// UI state
const showEntryModal = ref(false)
const editingEntry = ref<SessionEntry | null>(null)
const expandedComments = ref<Set<string>>(new Set())
const newCommentContent = ref<Record<string, string>>({})
const lightboxUrl = ref<string | null>(null)

const _unsubs: (() => void)[] = []

const canEdit = computed(() => auth.isDm || auth.isAdmin)

const entryTypeConfig: Record<SessionEntryType, { icon: string; label: string; color: string; borderColor: string }> = {
  interaction: { icon: '🤝', label: 'Interaction', color: 'bg-purple-500/15 text-purple-400', borderColor: 'border-l-purple-500/50' },
  task: { icon: '✅', label: 'Task', color: 'bg-green-500/15 text-green-400', borderColor: 'border-l-green-500/50' },
  encounter: { icon: '⚔️', label: 'Encounter', color: 'bg-red-500/15 text-red-400', borderColor: 'border-l-red-500/50' },
  discovery: { icon: '🔍', label: 'Discovery', color: 'bg-blue-500/15 text-blue-400', borderColor: 'border-l-blue-500/50' },
  travel: { icon: '🚶', label: 'Travel', color: 'bg-amber-500/15 text-amber-400', borderColor: 'border-l-amber-500/50' },
  rest: { icon: '🏕️', label: 'Rest', color: 'bg-teal-500/15 text-teal-400', borderColor: 'border-l-teal-500/50' },
  custom: { icon: '📝', label: 'Custom', color: 'bg-zinc-500/15 text-zinc-400', borderColor: 'border-l-zinc-500/50' },
}

onMounted(() => {
  // Load entries real-time
  const entriesQuery = query(
    collection(db, 'sessionEntries'),
    where('sessionId', '==', props.sessionId),
    orderBy('order', 'asc')
  )
  _unsubs.push(onSnapshot(entriesQuery, (snap) => {
    entries.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEntry))
  }, (err) => {
    console.warn('Session entries query error:', err.message)
  }))

  // Load NPCs for display
  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name')), (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }))

  // Load locations for display
  _unsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name')), (snap) => {
    locations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
  }))

  // Load features for display
  _unsubs.push(onSnapshot(query(collection(db, 'features'), orderBy('name')), (snap) => {
    features.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
  }))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

function getNpcName(id: string): string { return npcs.value.find(n => n.id === id)?.name || id }
function getLocationName(id: string): string { return locations.value.find(l => l.id === id)?.name || id }
function getFeatureName(id: string): string { return features.value.find(f => f.id === id)?.name || id }

function openAddModal() {
  editingEntry.value = null
  showEntryModal.value = true
}

function openEditModal(entry: SessionEntry) {
  editingEntry.value = entry
  showEntryModal.value = true
}

function closeModal() {
  showEntryModal.value = false
  editingEntry.value = null
}

async function handleModalSubmit(data: Partial<SessionEntry>) {
  if (editingEntry.value) {
    // Update existing
    await updateDoc(doc(db, 'sessionEntries', editingEntry.value.id), {
      ...data,
      updatedAt: Timestamp.now(),
    })
  } else {
    // Add new
    const maxOrder = entries.value.length > 0 ? Math.max(...entries.value.map(e => e.order)) : 0
    await addDoc(collection(db, 'sessionEntries'), {
      ...data,
      sessionId: props.sessionId,
      order: maxOrder + 1,
      comments: [],
      createdBy: auth.firebaseUser?.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  }
  closeModal()
}

async function deleteEntry(entryId: string) {
  if (!confirm('Delete this timeline entry?')) return
  await deleteDoc(doc(db, 'sessionEntries', entryId))
}

async function moveEntry(entryId: string, direction: 'up' | 'down') {
  const idx = entries.value.findIndex(e => e.id === entryId)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= entries.value.length) return

  const current = entries.value[idx]!
  const swap = entries.value[swapIdx]!

  // Swap order values
  await Promise.all([
    updateDoc(doc(db, 'sessionEntries', current.id), { order: swap.order }),
    updateDoc(doc(db, 'sessionEntries', swap.id), { order: current.order }),
  ])
}

function toggleComments(entryId: string) {
  if (expandedComments.value.has(entryId)) {
    expandedComments.value.delete(entryId)
  } else {
    expandedComments.value.add(entryId)
  }
}

async function addComment(entryId: string) {
  const content = newCommentContent.value[entryId]?.trim()
  if (!content || !auth.firebaseUser) return

  const entry = entries.value.find(e => e.id === entryId)
  if (!entry) return

  const newComment: EntryComment = {
    id: crypto.randomUUID(),
    userId: auth.firebaseUser.uid,
    authorName: auth.appUser?.displayName || 'Unknown',
    content,
    createdAt: Timestamp.now() as any,
  }

  const currentComments = entry.comments || []
  await updateDoc(doc(db, 'sessionEntries', entryId), {
    comments: [...currentComments, newComment],
    updatedAt: Timestamp.now(),
  })
  newCommentContent.value[entryId] = ''
}

async function deleteComment(entryId: string, commentId: string) {
  const entry = entries.value.find(e => e.id === entryId)
  if (!entry) return
  const updated = (entry.comments || []).filter(c => c.id !== commentId)
  await updateDoc(doc(db, 'sessionEntries', entryId), {
    comments: updated,
    updatedAt: Timestamp.now(),
  })
}

function canDeleteComment(comment: EntryComment): boolean {
  return comment.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin
}

function formatCommentDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="mt-8 border-t border-white/[0.06] pt-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-[#ef233c]" style="font-family: Manrope, sans-serif">⏳ Session Timeline</h2>
      <button v-if="canEdit" @click="openAddModal" class="btn !text-xs !py-1.5 !px-3">
        + Add Entry
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="entries.length === 0" class="text-zinc-600 text-sm py-8 text-center">
      No timeline entries yet.
      <span v-if="canEdit"> Click "Add Entry" to begin documenting this session.</span>
    </div>

    <!-- Timeline -->
    <div v-if="entries.length > 0" class="relative pl-6 ml-2">
      <!-- Vertical line -->
      <div class="absolute left-0 top-0 bottom-0 w-px bg-zinc-800" />

      <!-- Entries -->
      <div v-for="(entry, idx) in entries" :key="entry.id" class="relative mb-5">
        <!-- Timeline dot -->
        <div class="absolute -left-6 top-4 w-3 h-3 rounded-full border-2 border-zinc-700 bg-zinc-900 z-10"
          :class="{
            '!border-purple-500 !bg-purple-500/20': entry.type === 'interaction',
            '!border-green-500 !bg-green-500/20': entry.type === 'task',
            '!border-red-500 !bg-red-500/20': entry.type === 'encounter',
            '!border-blue-500 !bg-blue-500/20': entry.type === 'discovery',
            '!border-amber-500 !bg-amber-500/20': entry.type === 'travel',
            '!border-teal-500 !bg-teal-500/20': entry.type === 'rest',
            '!border-zinc-500 !bg-zinc-500/20': entry.type === 'custom',
          }"
        />

        <!-- Entry card -->
        <div :class="['card-flat border-l-4 overflow-visible', entryTypeConfig[entry.type]?.borderColor || 'border-l-zinc-700']">
          <div class="flex">
            <!-- Hero image on the left -->
            <div v-if="entry.imageUrl" class="shrink-0 w-28 sm:w-36 overflow-hidden rounded-l-[inherit] cursor-pointer" @click="lightboxUrl = entry.imageUrl!">
              <img :src="entry.imageUrl" class="w-full h-full object-cover" />
            </div>
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <!-- Header -->
              <div class="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
                <div class="flex items-center gap-2 flex-wrap min-w-0">
                  <span :class="['text-xs px-2 py-0.5 rounded-md font-semibold', entryTypeConfig[entry.type]?.color || 'bg-zinc-500/15 text-zinc-400']">
                    {{ entryTypeConfig[entry.type]?.icon }} {{ entryTypeConfig[entry.type]?.label }}
                  </span>
                  <h3 class="text-sm font-semibold text-zinc-100" style="font-family: Manrope, sans-serif">{{ entry.title }}</h3>
                </div>
                <div v-if="canEdit" class="flex items-center gap-1 shrink-0">
                  <button v-if="idx > 0" @click="moveEntry(entry.id, 'up')" class="text-zinc-600 hover:text-zinc-300 text-xs p-1 transition-colors" title="Move up">↑</button>
                  <button v-if="idx < entries.length - 1" @click="moveEntry(entry.id, 'down')" class="text-zinc-600 hover:text-zinc-300 text-xs p-1 transition-colors" title="Move down">↓</button>
                  <button @click="openEditModal(entry)" class="text-zinc-600 hover:text-[#ef233c] text-xs p-1 transition-colors" title="Edit">✏️</button>
                  <button @click="deleteEntry(entry.id)" class="text-zinc-600 hover:text-red-400 text-xs p-1 transition-colors" title="Delete">🗑️</button>
                </div>
              </div>
              <!-- Participants (if not everyone) -->
              <div v-if="entry.allParticipantsPresent === false && entry.presentParticipants?.length" class="px-4 pb-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[0.65rem] text-zinc-600 uppercase tracking-wider">Present:</span>
                  <span v-for="p in entry.presentParticipants" :key="p.characterId" class="text-xs bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded">{{ p.characterName }}</span>
                </div>
              </div>
              <!-- Description -->
              <div v-if="entry.description" class="px-4 py-2">
                <div class="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  <MentionText :text="entry.description" />
                </div>
              </div>
              <!-- Tags: NPCs, locations, features -->
              <div v-if="(entry.npcIds?.length || entry.linkedLocationIds?.length || entry.linkedFeatureIds?.length)" class="px-4 pb-3">
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="id in entry.npcIds" :key="'npc-'+id" class="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">👤 {{ getNpcName(id) }}</span>
                  <span v-for="id in entry.linkedLocationIds" :key="'loc-'+id" class="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">🏰 {{ getLocationName(id) }}</span>
                  <span v-for="id in entry.linkedFeatureIds" :key="'feat-'+id" class="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-md border border-green-500/20">📌 {{ getFeatureName(id) }}</span>
                </div>
              </div>
              <!-- Attachments -->
              <div v-if="entry.attachments?.length" class="px-4 pb-3">
                <div class="flex flex-wrap gap-2">
                  <a v-for="att in entry.attachments" :key="att.url" :href="att.url" target="_blank" class="text-xs text-zinc-400 hover:text-zinc-200 bg-white/5 px-2 py-1 rounded border border-white/[0.06] transition-colors">📎 {{ att.name }}</a>
                </div>
              </div>
              <!-- Comments section -->
              <div class="border-t border-white/[0.04] px-4 py-2">
                <button @click="toggleComments(entry.id)" class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                  <span>{{ expandedComments.has(entry.id) ? '▾' : '▸' }}</span>
                  <span>💬 {{ entry.comments?.length || 0 }} comment{{ (entry.comments?.length || 0) !== 1 ? 's' : '' }}</span>
                </button>
                <div v-if="expandedComments.has(entry.id)" class="mt-2 space-y-2">
                  <div v-for="comment in (entry.comments || [])" :key="comment.id" class="pl-3 border-l border-white/[0.06]">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs text-[#ef233c]/80 font-medium">{{ comment.authorName }}</span>
                        <span class="text-[0.65rem] text-zinc-600">{{ formatCommentDate(comment.createdAt) }}</span>
                      </div>
                      <button v-if="canDeleteComment(comment)" @click="deleteComment(entry.id, comment.id)" class="text-zinc-600 hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                    <p class="text-xs text-zinc-400 mt-0.5">{{ comment.content }}</p>
                  </div>
                  <div v-if="auth.isAuthenticated" class="flex gap-2 mt-2">
                    <input v-model="newCommentContent[entry.id]" type="text" placeholder="Add a comment..." class="input flex-1 !text-xs !py-1.5" @keydown.enter="addComment(entry.id)" />
                    <button @click="addComment(entry.id)" :disabled="!newCommentContent[entry.id]?.trim()" class="btn-action !py-1.5">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Add button at bottom if entries exist -->
    <div v-if="canEdit && entries.length > 0" class="mt-2 ml-8">
      <button @click="openAddModal" class="btn-action">
        + Add another entry
      </button>
    </div>

    <!-- Image Lightbox -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="lightboxUrl" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center" @click="lightboxUrl = null">
          <img :src="lightboxUrl" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" @click.stop />
          <button @click="lightboxUrl = null" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-lg">✕</button>
        </div>
      </transition>
    </Teleport>

    <!-- Entry Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showEntryModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="closeModal" />
          <div class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 z-10">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">
                {{ editingEntry ? '✏️ Edit Entry' : '➕ New Timeline Entry' }}
              </h3>
              <button @click="closeModal" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>
            <SessionEntryForm
              :entry="editingEntry"
              :session-participants="sessionParticipants"
              :entry-id="editingEntry?.id"
              @submit="handleModalSubmit"
              @cancel="closeModal"
            />
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

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
const insertAfterOrder = ref<number | null>(null) // for inserting between entries
const expandedComments = ref<Set<string>>(new Set())
const newCommentContent = ref<Record<string, string>>({})
const lightboxUrl = ref<string | null>(null)

// Drag state
const dragEntryId = ref<string | null>(null)
const dragOverEntryId = ref<string | null>(null)

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

// Dot color mapping for timeline circles
const dotColorMap: Record<SessionEntryType, string> = {
  interaction: 'bg-purple-500',
  task: 'bg-green-500',
  encounter: 'bg-red-500',
  discovery: 'bg-blue-500',
  travel: 'bg-amber-500',
  rest: 'bg-teal-500',
  custom: 'bg-zinc-500',
}

onMounted(() => {
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

  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name')), (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }))
  _unsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name')), (snap) => {
    locations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
  }))
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
  insertAfterOrder.value = null
  showEntryModal.value = true
}

function openInsertModal(afterEntryId: string) {
  editingEntry.value = null
  const afterEntry = entries.value.find(e => e.id === afterEntryId)
  insertAfterOrder.value = afterEntry ? afterEntry.order : null
  showEntryModal.value = true
}

function openEditModal(entry: SessionEntry) {
  editingEntry.value = entry
  insertAfterOrder.value = null
  showEntryModal.value = true
}

function closeModal() {
  showEntryModal.value = false
  editingEntry.value = null
  insertAfterOrder.value = null
}

async function handleModalSubmit(data: Partial<SessionEntry>) {
  if (editingEntry.value) {
    await updateDoc(doc(db, 'sessionEntries', editingEntry.value.id), {
      ...data,
      updatedAt: Timestamp.now(),
    })
  } else if (insertAfterOrder.value !== null) {
    // Insert between: shift all entries after insertAfterOrder up by 1
    const afterOrder = insertAfterOrder.value
    const toShift = entries.value.filter(e => e.order > afterOrder)
    await Promise.all(toShift.map(e =>
      updateDoc(doc(db, 'sessionEntries', e.id), { order: e.order + 1 })
    ))
    await addDoc(collection(db, 'sessionEntries'), {
      ...data,
      sessionId: props.sessionId,
      order: afterOrder + 1,
      comments: [],
      createdBy: auth.firebaseUser?.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  } else {
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

// Drag and drop reorder
function onDragStart(e: DragEvent, entryId: string) {
  dragEntryId.value = entryId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', entryId)
  }
}

function onDragOver(e: DragEvent, entryId: string) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverEntryId.value = entryId
}

function onDragLeave() {
  dragOverEntryId.value = null
}

async function onDrop(e: DragEvent, targetEntryId: string) {
  e.preventDefault()
  dragOverEntryId.value = null
  const srcId = dragEntryId.value
  dragEntryId.value = null
  if (!srcId || srcId === targetEntryId) return

  const srcIdx = entries.value.findIndex(e => e.id === srcId)
  const tgtIdx = entries.value.findIndex(e => e.id === targetEntryId)
  if (srcIdx < 0 || tgtIdx < 0) return

  // Build new order: remove src, insert at tgt position
  const reordered = [...entries.value]
  const [moved] = reordered.splice(srcIdx, 1)
  reordered.splice(tgtIdx, 0, moved!)

  // Write new order values
  await Promise.all(reordered.map((entry, i) =>
    updateDoc(doc(db, 'sessionEntries', entry.id), { order: i + 1 })
  ))
}

function onDragEnd() {
  dragEntryId.value = null
  dragOverEntryId.value = null
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
  await updateDoc(doc(db, 'sessionEntries', entryId), {
    comments: [...(entry.comments || []), newComment],
    updatedAt: Timestamp.now(),
  })
  newCommentContent.value[entryId] = ''
}

async function deleteComment(entryId: string, commentId: string) {
  const entry = entries.value.find(e => e.id === entryId)
  if (!entry) return
  const updated = (entry.comments || []).filter(c => c.id !== commentId)
  await updateDoc(doc(db, 'sessionEntries', entryId), { comments: updated, updatedAt: Timestamp.now() })
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
      <button v-if="canEdit" @click="openAddModal" class="btn !text-xs !py-1.5 !px-3">+ Add Entry</button>
    </div>

    <!-- Empty state -->
    <div v-if="entries.length === 0" class="text-zinc-600 text-sm py-8 text-center">
      No timeline entries yet.
      <span v-if="canEdit"> Click "Add Entry" to begin documenting this session.</span>
    </div>

    <!-- Classic vertical timeline -->
    <div v-if="entries.length > 0" class="relative pb-4 max-w-[1200px]">
      <!-- Center line (desktop) -->
      <div class="hidden sm:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-zinc-700 -translate-x-1/2" />
      <!-- Left line (mobile) -->
      <div class="sm:hidden absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-700" />

      <template v-for="(entry, idx) in entries" :key="entry.id">
        <!-- Insert button between entries -->
        <div v-if="canEdit && idx > 0" class="relative h-8 sm:h-10">
          <!-- Desktop: centered on line -->
          <div class="hidden sm:flex absolute inset-0 justify-center items-center">
            <button
              @click="openInsertModal(entries[idx - 1]!.id)"
              class="w-6 h-6 rounded-full border-2 border-zinc-700 bg-zinc-900 text-zinc-600 hover:text-[#ef233c] hover:border-[#ef233c]/50 flex items-center justify-center text-xs transition-colors z-10"
              title="Insert entry here"
            >+</button>
          </div>
          <!-- Mobile: on left line -->
          <div class="sm:hidden absolute left-5 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <button
              @click="openInsertModal(entries[idx - 1]!.id)"
              class="w-5 h-5 rounded-full border-2 border-zinc-700 bg-zinc-900 text-zinc-600 hover:text-[#ef233c] hover:border-[#ef233c]/50 flex items-center justify-center text-[0.6rem] transition-colors"
              title="Insert entry here"
            >+</button>
          </div>
        </div>
        <!-- Spacer between entries (when not canEdit) -->
        <div v-else-if="idx > 0" class="h-6 sm:h-10" />

        <!-- Entry row -->
        <div
          class="relative flex items-start pl-10 sm:pl-0"
          :class="idx % 2 === 0 ? '' : 'sm:flex-row-reverse'"
        >
          <!-- Card container -->
          <div class="flex-1 sm:flex-none sm:w-[45%]">
            <div
              :class="[
                'card-flat border-l-4 overflow-visible transition-all duration-150 relative timeline-card',
                entryTypeConfig[entry.type]?.borderColor || 'border-l-zinc-700',
                idx % 2 === 0 ? 'timeline-card-even' : 'timeline-card-odd',
                canEdit ? 'cursor-grab active:cursor-grabbing' : '',
                dragEntryId === entry.id ? 'opacity-40 scale-95' : '',
                dragOverEntryId === entry.id && dragEntryId !== entry.id ? 'ring-2 ring-[#ef233c]/50 scale-[1.02]' : '',
              ]"
              :draggable="canEdit ? 'true' : 'false'"
              @dragstart="canEdit && onDragStart($event, entry.id)"
              @dragover="canEdit && onDragOver($event, entry.id)"
              @dragleave="canEdit && onDragLeave()"
              @drop="canEdit && onDrop($event, entry.id)"
              @dragend="canEdit && onDragEnd()"
            >
              <!-- Card inner: image + content side by side on desktop -->
              <div class="flex flex-col sm:flex-row" :class="idx % 2 === 0 ? 'sm:flex-row-reverse' : ''">
                <!-- Image (outer edge side on desktop, top on mobile) -->
                <div v-if="entry.imageUrl" class="sm:w-2/5 shrink-0 overflow-hidden cursor-pointer" :class="[idx % 2 === 0 ? 'sm:rounded-r-[inherit]' : 'sm:rounded-l-[inherit]', 'rounded-t-[inherit] sm:rounded-t-none']" @click="lightboxUrl = entry.imageUrl!">
                  <img :src="entry.imageUrl" class="w-full h-full object-cover sm:min-h-full" :class="entry.imageUrl ? 'aspect-[3/1] sm:aspect-auto' : ''" draggable="false" />
                </div>
                <!-- Text content -->
                <div class="flex-1 min-w-0 px-4 pt-3 pb-2.5">
                  <!-- Type badge + edit/delete -->
                  <div class="flex items-start justify-between gap-2 mb-1.5">
                    <span :class="['text-xs px-2 py-1 rounded font-semibold leading-none', entryTypeConfig[entry.type]?.color || 'bg-zinc-500/15 text-zinc-400']">
                      {{ entryTypeConfig[entry.type]?.icon }} {{ entryTypeConfig[entry.type]?.label }}
                    </span>
                    <div v-if="canEdit" class="flex items-center gap-1 shrink-0">
                      <button @click="openEditModal(entry)" class="text-zinc-600 hover:text-[#ef233c] text-sm p-1 transition-colors" title="Edit">✏️</button>
                      <button @click="deleteEntry(entry.id)" class="text-zinc-600 hover:text-red-400 text-sm p-1 transition-colors" title="Delete">🗑️</button>
                    </div>
                  </div>
                  <!-- Title -->
                  <h3 class="text-base font-semibold text-zinc-100 leading-tight mb-1.5" style="font-family: Manrope, sans-serif">{{ entry.title }}</h3>
                  <!-- Participants -->
                  <div v-if="entry.allParticipantsPresent === false && entry.presentParticipants?.length" class="mb-1.5">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-[0.7rem] text-zinc-600 uppercase tracking-wider">Present:</span>
                      <span v-for="p in entry.presentParticipants" :key="p.characterId" class="text-xs bg-white/5 text-zinc-500 px-1.5 py-0.5 rounded">{{ p.characterName }}</span>
                    </div>
                  </div>
                  <!-- Description -->
                  <div v-if="entry.description" class="text-sm text-zinc-400 leading-relaxed line-clamp-4 mb-2">
                    <MentionText :text="entry.description" />
                  </div>
                  <!-- NPC / Location / Feature badges -->
                  <div v-if="(entry.npcIds?.length || entry.linkedLocationIds?.length || entry.linkedFeatureIds?.length)" class="flex flex-wrap gap-1.5 mb-2">
                    <span v-for="id in entry.npcIds" :key="'npc-'+id" class="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">👤 {{ getNpcName(id) }}</span>
                    <span v-for="id in entry.linkedLocationIds" :key="'loc-'+id" class="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">🏰 {{ getLocationName(id) }}</span>
                    <span v-for="id in entry.linkedFeatureIds" :key="'feat-'+id" class="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">📌 {{ getFeatureName(id) }}</span>
                  </div>
                  <!-- Attachments -->
                  <div v-if="entry.attachments?.length" class="flex flex-wrap gap-1.5 mb-2">
                    <a v-for="att in entry.attachments" :key="att.url" :href="att.url" target="_blank" class="text-xs text-zinc-500 hover:text-zinc-300 bg-white/5 px-2 py-0.5 rounded border border-white/[0.06] transition-colors">📎 {{ att.name }}</a>
                  </div>
                </div>
              </div>
              <!-- Comments section -->
              <div class="border-t border-white/[0.04] px-4 py-2">
                <button @click="toggleComments(entry.id)" class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                  <span>{{ expandedComments.has(entry.id) ? '▾' : '▸' }}</span>
                  <span>💬 {{ entry.comments?.length || 0 }}</span>
                </button>
                <div v-if="expandedComments.has(entry.id)" class="mt-2 space-y-2">
                  <div v-for="comment in (entry.comments || [])" :key="comment.id" class="pl-2.5 border-l border-white/[0.06]">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs text-[#ef233c]/80 font-medium">{{ comment.authorName }}</span>
                        <span class="text-[0.7rem] text-zinc-600">{{ formatCommentDate(comment.createdAt) }}</span>
                      </div>
                      <button v-if="canDeleteComment(comment)" @click="deleteComment(entry.id, comment.id)" class="text-zinc-600 hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                    <p class="text-xs text-zinc-500 mt-0.5">{{ comment.content }}</p>
                  </div>
                  <div v-if="auth.isAuthenticated && !auth.isGuest" class="flex gap-1.5 mt-1.5">
                    <input v-model="newCommentContent[entry.id]" type="text" placeholder="Comment..." class="input flex-1 !text-xs !py-1.5 !px-2.5" @keydown.enter="addComment(entry.id)" />
                    <button @click="addComment(entry.id)" :disabled="!newCommentContent[entry.id]?.trim()" class="btn-action !py-1.5 !text-xs">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Desktop: center spacer with dot -->
          <div class="hidden sm:flex sm:w-[10%] justify-center pt-3">
            <div :class="['w-4 h-4 rounded-full border-2 border-zinc-800 z-10', dotColorMap[entry.type] || 'bg-zinc-500']" />
          </div>

          <!-- Mobile: dot on left line (absolute) -->
          <div :class="['sm:hidden absolute left-5 -translate-x-1/2 top-3 w-3 h-3 rounded-full border-2 border-zinc-800 z-10', dotColorMap[entry.type] || 'bg-zinc-500']" />

          <!-- Desktop: empty spacer opposite side -->
          <div class="hidden sm:block sm:w-[45%]" />
        </div>
      </template>
    </div>

    <!-- Add at end -->
    <div v-if="canEdit && entries.length > 0" class="mt-3 flex justify-center">
      <button @click="openAddModal" class="btn-action">+ Add entry</button>
    </div>

    <!-- Image Lightbox -->
    <Teleport to="body">
      <transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="lightboxUrl" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center" @click="lightboxUrl = null">
          <img :src="lightboxUrl" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" @click.stop />
          <button @click="lightboxUrl = null" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-lg">✕</button>
        </div>
      </transition>
    </Teleport>

    <!-- Entry Modal -->
    <Teleport to="body">
      <transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showEntryModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="closeModal" />
          <div class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 z-10">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">
                {{ editingEntry ? '✏️ Edit Entry' : insertAfterOrder !== null ? '➕ Insert Entry' : '➕ New Timeline Entry' }}
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

<style scoped>
/* Mobile arrow — always points left (toward the left line) */
.timeline-card::before {
  content: '';
  position: absolute;
  top: 14px;
  left: -6px;
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  transform: rotate(45deg);
}

@media (min-width: 640px) {
  .timeline-card::before {
    display: none;
  }
}

/* Desktop arrow — points right (for even/left-side cards) */
.timeline-card-even::after {
  content: '';
  position: absolute;
  top: 14px;
  right: -6px;
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  transform: rotate(45deg);
  display: none;
}

@media (min-width: 640px) {
  .timeline-card-even::after {
    display: block;
  }
}

/* Desktop arrow — points left (for odd/right-side cards) */
.timeline-card-odd::after {
  content: '';
  position: absolute;
  top: 14px;
  left: -6px;
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  transform: rotate(45deg);
  display: none;
}

@media (min-width: 640px) {
  .timeline-card-odd::after {
    display: block;
  }
}
</style>

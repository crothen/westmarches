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

// Serpentine layout: group entries into rows of 3, alternating direction
const serpentineRows = computed(() => {
  const rows: { entries: SessionEntry[]; reversed: boolean }[] = []
  for (let i = 0; i < entries.value.length; i += 3) {
    const chunk = entries.value.slice(i, i + 3)
    const rowIndex = Math.floor(i / 3)
    rows.push({ entries: chunk, reversed: rowIndex % 2 === 1 })
  }
  return rows
})

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

    <!-- Serpentine 3-column layout with connecting lines -->
    <div v-if="entries.length > 0">
      <template v-for="(row, rowIdx) in serpentineRows" :key="rowIdx">
        <!-- Row of up to 3 entries with horizontal connectors -->
        <div class="hidden sm:flex items-stretch" :class="row.reversed ? 'flex-row-reverse' : 'flex-row'">
          <template v-for="(entry, colIdx) in row.entries" :key="entry.id">
            <!-- Horizontal connector (between cards, not before first) -->
            <div v-if="colIdx > 0" class="flex items-center shrink-0 w-10">
              <div class="w-full h-0.5 bg-zinc-600" />
            </div>
            <!-- Entry card -->
            <div
              :class="[
                'card-flat border-l-4 overflow-visible transition-all duration-150 flex-1 min-w-0',
                entryTypeConfig[entry.type]?.borderColor || 'border-l-zinc-700',
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
              <div v-if="entry.imageUrl" class="w-full overflow-hidden rounded-t-[inherit] cursor-pointer" style="aspect-ratio: 3 / 1" @click="lightboxUrl = entry.imageUrl!">
                <img :src="entry.imageUrl" class="w-full h-full object-cover" draggable="false" />
              </div>
              <div class="px-3 pt-2.5 pb-2">
                <div class="flex items-start justify-between gap-1 mb-1">
                  <span :class="['text-[0.65rem] px-1.5 py-0.5 rounded font-semibold leading-none', entryTypeConfig[entry.type]?.color || 'bg-zinc-500/15 text-zinc-400']">
                    {{ entryTypeConfig[entry.type]?.icon }} {{ entryTypeConfig[entry.type]?.label }}
                  </span>
                  <div v-if="canEdit" class="flex items-center gap-0.5 shrink-0 -mt-0.5">
                    <button @click="openEditModal(entry)" class="text-zinc-600 hover:text-[#ef233c] text-[0.65rem] p-0.5 transition-colors" title="Edit">✏️</button>
                    <button @click="deleteEntry(entry.id)" class="text-zinc-600 hover:text-red-400 text-[0.65rem] p-0.5 transition-colors" title="Delete">🗑️</button>
                  </div>
                </div>
                <h3 class="text-sm font-semibold text-zinc-100 leading-tight mb-1" style="font-family: Manrope, sans-serif">{{ entry.title }}</h3>
                <div v-if="entry.allParticipantsPresent === false && entry.presentParticipants?.length" class="mb-1">
                  <div class="flex items-center gap-1 flex-wrap">
                    <span class="text-[0.6rem] text-zinc-600 uppercase tracking-wider">Present:</span>
                    <span v-for="p in entry.presentParticipants" :key="p.characterId" class="text-[0.65rem] bg-white/5 text-zinc-500 px-1 py-0.5 rounded">{{ p.characterName }}</span>
                  </div>
                </div>
                <div v-if="entry.description" class="text-xs text-zinc-400 leading-relaxed line-clamp-4 mb-2">
                  <MentionText :text="entry.description" />
                </div>
                <div v-if="(entry.npcIds?.length || entry.linkedLocationIds?.length || entry.linkedFeatureIds?.length)" class="flex flex-wrap gap-1 mb-2">
                  <span v-for="id in entry.npcIds" :key="'npc-'+id" class="text-[0.6rem] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">👤 {{ getNpcName(id) }}</span>
                  <span v-for="id in entry.linkedLocationIds" :key="'loc-'+id" class="text-[0.6rem] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">🏰 {{ getLocationName(id) }}</span>
                  <span v-for="id in entry.linkedFeatureIds" :key="'feat-'+id" class="text-[0.6rem] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">📌 {{ getFeatureName(id) }}</span>
                </div>
                <div v-if="entry.attachments?.length" class="flex flex-wrap gap-1 mb-2">
                  <a v-for="att in entry.attachments" :key="att.url" :href="att.url" target="_blank" class="text-[0.6rem] text-zinc-500 hover:text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/[0.06] transition-colors">📎 {{ att.name }}</a>
                </div>
              </div>
              <div class="border-t border-white/[0.04] px-3 py-1.5">
                <button @click="toggleComments(entry.id)" class="text-[0.65rem] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                  <span>{{ expandedComments.has(entry.id) ? '▾' : '▸' }}</span>
                  <span>💬 {{ entry.comments?.length || 0 }}</span>
                </button>
                <div v-if="expandedComments.has(entry.id)" class="mt-1.5 space-y-1.5">
                  <div v-for="comment in (entry.comments || [])" :key="comment.id" class="pl-2 border-l border-white/[0.06]">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1">
                        <span class="text-[0.65rem] text-[#ef233c]/80 font-medium">{{ comment.authorName }}</span>
                        <span class="text-[0.6rem] text-zinc-600">{{ formatCommentDate(comment.createdAt) }}</span>
                      </div>
                      <button v-if="canDeleteComment(comment)" @click="deleteComment(entry.id, comment.id)" class="text-zinc-600 hover:text-red-400 text-[0.6rem] transition-colors">✕</button>
                    </div>
                    <p class="text-[0.65rem] text-zinc-500 mt-0.5">{{ comment.content }}</p>
                  </div>
                  <div v-if="auth.isAuthenticated" class="flex gap-1.5 mt-1">
                    <input v-model="newCommentContent[entry.id]" type="text" placeholder="Comment..." class="input flex-1 !text-[0.65rem] !py-1 !px-2" @keydown.enter="addComment(entry.id)" />
                    <button @click="addComment(entry.id)" :disabled="!newCommentContent[entry.id]?.trim()" class="btn-action !py-1 !text-[0.6rem]">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <!-- Fill empty slots in last row -->
          <template v-if="row.entries.length < 3">
            <template v-for="n in (3 - row.entries.length)" :key="'empty-'+n">
              <div class="w-10 shrink-0" /><!-- spacer for missing connector -->
              <div v-if="canEdit && rowIdx === serpentineRows.length - 1 && n === 1"
                class="flex-1 border border-dashed border-white/[0.08] rounded-xl flex items-center justify-center min-h-[100px] hover:border-[#ef233c]/30 hover:bg-[#ef233c]/[0.02] transition-all cursor-pointer group"
                @click="openAddModal"
              >
                <span class="text-zinc-700 group-hover:text-[#ef233c]/50 text-sm transition-colors">+ Add Entry</span>
              </div>
              <div v-else class="flex-1" /><!-- empty spacer -->
            </template>
          </template>
        </div>

        <!-- Mobile: single column with vertical line -->
        <div class="sm:hidden space-y-2">
          <template v-for="(entry, colIdx) in row.entries" :key="entry.id">
            <div v-if="colIdx > 0 || rowIdx > 0" class="flex justify-center py-1">
              <div class="h-4 w-px bg-zinc-700" />
            </div>
            <div
              :class="[
                'card-flat border-l-4 overflow-visible transition-all duration-150',
                entryTypeConfig[entry.type]?.borderColor || 'border-l-zinc-700',
              ]"
            >
              <div v-if="entry.imageUrl" class="w-full overflow-hidden rounded-t-[inherit] cursor-pointer" style="aspect-ratio: 3 / 1" @click="lightboxUrl = entry.imageUrl!">
                <img :src="entry.imageUrl" class="w-full h-full object-cover" />
              </div>
              <div class="px-3 pt-2.5 pb-2">
                <div class="flex items-start justify-between gap-1 mb-1">
                  <span :class="['text-[0.65rem] px-1.5 py-0.5 rounded font-semibold leading-none', entryTypeConfig[entry.type]?.color || 'bg-zinc-500/15 text-zinc-400']">
                    {{ entryTypeConfig[entry.type]?.icon }} {{ entryTypeConfig[entry.type]?.label }}
                  </span>
                  <div v-if="canEdit" class="flex items-center gap-0.5 shrink-0 -mt-0.5">
                    <button @click="openEditModal(entry)" class="text-zinc-600 hover:text-[#ef233c] text-[0.65rem] p-0.5 transition-colors">✏️</button>
                    <button @click="deleteEntry(entry.id)" class="text-zinc-600 hover:text-red-400 text-[0.65rem] p-0.5 transition-colors">🗑️</button>
                  </div>
                </div>
                <h3 class="text-sm font-semibold text-zinc-100 leading-tight mb-1" style="font-family: Manrope, sans-serif">{{ entry.title }}</h3>
                <div v-if="entry.description" class="text-xs text-zinc-400 leading-relaxed line-clamp-4 mb-2">
                  <MentionText :text="entry.description" />
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Vertical connector between rows (desktop) -->
        <div v-if="rowIdx < serpentineRows.length - 1" class="hidden sm:flex relative h-14"
          :class="row.reversed ? 'justify-start pl-[calc(16.67%-12px)]' : 'justify-end pr-[calc(16.67%-12px)]'"
        >
          <div class="flex flex-col items-center">
            <div class="flex-1 w-0.5 bg-zinc-600" />
            <!-- Insert button on the line -->
            <button
              v-if="canEdit"
              @click="openInsertModal(row.entries[row.entries.length - 1]!.id)"
              class="w-6 h-6 rounded-full border-2 border-zinc-600 bg-zinc-900 text-zinc-500 hover:text-[#ef233c] hover:border-[#ef233c]/50 flex items-center justify-center text-sm transition-colors shrink-0"
              title="Insert entry here"
            >+</button>
            <div v-else class="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
            <div class="flex-1 w-0.5 bg-zinc-600" />
          </div>
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

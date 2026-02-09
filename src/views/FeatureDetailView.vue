<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, collection, query, where, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useTypeConfig } from '../composables/useTypeConfig'
import TypeSelect from '../components/common/TypeSelect.vue'
import MentionTextarea from '../components/common/MentionTextarea.vue'
import MentionText from '../components/common/MentionText.vue'
import HexMiniMap from '../components/map/HexMiniMap.vue'
import type { LocationFeature, CampaignLocation, SessionEntry, SessionLog, SessionEntryType } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { featureTypes: featureTypeOptions, getIconUrl, getLabel } = useTypeConfig()

const feature = ref<LocationFeature | null>(null)
const parentLocation = ref<CampaignLocation | null>(null)
const loading = ref(true)

// Edit state
const showEditModal = ref(false)
const editForm = ref({ name: '', type: 'other' as any, description: '' })
const savingEdit = ref(false)

// Timeline entries
const timelineEntries = ref<SessionEntry[]>([])
const timelineSessions = ref<Map<string, SessionLog>>(new Map())
const loadingTimeline = ref(true)

const featureId = computed(() => route.params.id as string)

// Mini map hover/tap state
const miniMapHex = ref<string | null>(null)
const miniMapPos = ref({ x: 0, y: 0 })

function showMiniMap(hexKey: string, event: MouseEvent | TouchEvent) {
  const el = event.target as HTMLElement
  const rect = el.getBoundingClientRect()
  miniMapPos.value = { x: rect.left, y: rect.bottom + 4 }
  miniMapHex.value = hexKey
}

function hideMiniMap() {
  miniMapHex.value = null
}

function toggleMiniMap(hexKey: string, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (miniMapHex.value === hexKey) {
    miniMapHex.value = null
  } else {
    showMiniMap(hexKey, event)
  }
}

function onGlobalClick() {
  if (miniMapHex.value) miniMapHex.value = null
}

const entryTypeConfig: Record<SessionEntryType, { icon: string; label: string; color: string }> = {
  interaction: { icon: '🤝', label: 'Interaction', color: 'bg-purple-500/15 text-purple-400' },
  task: { icon: '✅', label: 'Task', color: 'bg-green-500/15 text-green-400' },
  encounter: { icon: '⚔️', label: 'Encounter', color: 'bg-red-500/15 text-red-400' },
  discovery: { icon: '🔍', label: 'Discovery', color: 'bg-blue-500/15 text-blue-400' },
  travel: { icon: '🚶', label: 'Travel', color: 'bg-amber-500/15 text-amber-400' },
  rest: { icon: '🏕️', label: 'Rest', color: 'bg-teal-500/15 text-teal-400' },
  custom: { icon: '📝', label: 'Custom', color: 'bg-zinc-500/15 text-zinc-400' },
}

const _unsubs: (() => void)[] = []

// Group entries by session
const entriesBySession = computed(() => {
  const groups = new Map<string, SessionEntry[]>()
  for (const entry of timelineEntries.value) {
    if (!groups.has(entry.sessionId)) groups.set(entry.sessionId, [])
    groups.get(entry.sessionId)!.push(entry)
  }
  // Sort groups by session date
  const sorted = [...groups.entries()].sort((a, b) => {
    const sa = timelineSessions.value.get(a[0])
    const sb = timelineSessions.value.get(b[0])
    const da = sa?.date ? ((sa.date as any).toDate ? (sa.date as any).toDate() : new Date(sa.date)) : new Date(0)
    const db_ = sb?.date ? ((sb.date as any).toDate ? (sb.date as any).toDate() : new Date(sb.date)) : new Date(0)
    return db_.getTime() - da.getTime()
  })
  return sorted
})

const hexKey = computed(() => {
  if (feature.value?.hexKey) return feature.value.hexKey
  if (parentLocation.value?.hexKey) return parentLocation.value.hexKey
  return null
})

onMounted(() => {
  document.addEventListener('click', onGlobalClick)

  // Listen to feature document
  _unsubs.push(onSnapshot(doc(db, 'features', featureId.value), (snap) => {
    if (snap.exists()) {
      feature.value = { id: snap.id, ...snap.data() } as LocationFeature
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load feature:', e)
    loading.value = false
  }))

  // Listen to timeline entries linked to this feature
  _unsubs.push(onSnapshot(
    query(collection(db, 'sessionEntries'), where('linkedFeatureIds', 'array-contains', featureId.value)),
    (snap) => {
      timelineEntries.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEntry))
      // Load session data for each unique session ID
      const sessionIds = [...new Set(timelineEntries.value.map(e => e.sessionId))]
      for (const sid of sessionIds) {
        if (!timelineSessions.value.has(sid)) {
          _unsubs.push(onSnapshot(doc(db, 'sessions', sid), (ssnap) => {
            if (ssnap.exists()) {
              timelineSessions.value.set(sid, { id: ssnap.id, ...ssnap.data() } as SessionLog)
            }
          }))
        }
      }
      loadingTimeline.value = false
    },
    (err) => {
      console.warn('Timeline entries query error:', err.message)
      loadingTimeline.value = false
    }
  ))
})

// Watch for parent location changes
watch(() => feature.value?.locationId, (locId) => {
  if (locId) {
    _unsubs.push(onSnapshot(doc(db, 'locations', locId), (snap) => {
      if (snap.exists()) {
        parentLocation.value = { id: snap.id, ...snap.data() } as CampaignLocation
      }
    }))
  } else {
    parentLocation.value = null
  }
}, { immediate: true })

// Redirect players away from hidden features
watch(feature, (feat) => {
  if (feat && feat.hidden && !(auth.isDm || auth.isAdmin)) {
    router.replace('/features')
  }
}, { immediate: true })

onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick)
  _unsubs.forEach(fn => fn())
})

function openEditModal() {
  if (!feature.value) return
  editForm.value = {
    name: feature.value.name,
    type: feature.value.type,
    description: feature.value.description || '',
  }
  showEditModal.value = true
}

async function saveEdit() {
  if (!feature.value || !editForm.value.name.trim()) return
  savingEdit.value = true
  const updates = {
    name: editForm.value.name.trim(),
    type: editForm.value.type,
    description: editForm.value.description.trim(),
    updatedAt: Timestamp.now(),
  }
  try {
    await updateDoc(doc(db, 'features', feature.value.id), updates)
    showEditModal.value = false
  } catch (e) {
    console.error('Failed to save feature:', e)
    alert('Failed to save.')
  } finally {
    savingEdit.value = false
  }
}

function formatSessionDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <RouterLink to="/features" class="text-[#ef233c] hover:text-red-400 text-sm mb-4 inline-block transition-colors">← Back to Points of Interest</RouterLink>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="!feature" class="card p-10 text-center relative z-10">
      <div class="relative z-10 text-zinc-600">Feature not found.</div>
    </div>

    <div v-else class="max-w-[1200px]">
      <!-- Hidden banner -->
      <div v-if="feature.hidden && (auth.isDm || auth.isAdmin)" class="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold uppercase tracking-widest text-center py-2 rounded-xl mb-4" style="font-family: Manrope, sans-serif">🚫 Hidden from players</div>

      <!-- Header -->
      <div class="flex items-center gap-3 mb-2">
        <img :src="getIconUrl(feature.type)" class="w-8 h-8 object-contain" :alt="feature.type" />
        <h1 class="text-3xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">{{ feature.name }}</h1>
        <span class="badge bg-white/5 text-zinc-500">{{ getLabel(feature.type) }}</span>
        <span class="flex-1"></span>
        <button
          v-if="auth.isDm || auth.isAdmin"
          @click="openEditModal"
          class="btn !text-xs !py-1.5"
        >✏️ Edit</button>
      </div>

      <!-- Meta info -->
      <div class="flex items-center gap-4 mb-4 flex-wrap">
        <RouterLink v-if="feature.locationId && parentLocation" :to="`/locations/${feature.locationId}`" class="text-sm text-zinc-500 hover:text-[#ef233c] transition-colors">
          🏰 {{ parentLocation.name }}
        </RouterLink>
        <span v-if="hexKey" class="text-sm text-zinc-600 cursor-default" @mouseenter="showMiniMap(hexKey!, $event)" @mouseleave="hideMiniMap" @click.prevent.stop="toggleMiniMap(hexKey!, $event)">📍 Hex {{ hexKey }}</span>
      </div>

      <!-- Description -->
      <div class="card p-4 relative z-10 mb-8">
        <div class="relative z-10">
          <p class="text-zinc-300 whitespace-pre-wrap"><MentionText :text="feature.description || 'No description.'" /></p>
        </div>
      </div>

      <!-- Timeline Entries Section -->
      <div class="border-t border-white/[0.06] pt-6">
        <h2 class="text-lg font-semibold text-[#ef233c] mb-4" style="font-family: Manrope, sans-serif">⏳ Timeline</h2>

        <div v-if="loadingTimeline" class="text-zinc-500 text-sm animate-pulse">Loading timeline...</div>
        <div v-else-if="entriesBySession.length === 0" class="text-zinc-600 text-sm">No session entries linked to this feature yet.</div>

        <div v-else class="space-y-6">
          <div v-for="[sessionId, entries] in entriesBySession" :key="sessionId">
            <!-- Session header -->
            <div class="flex items-center gap-2 mb-2">
              <RouterLink :to="`/sessions/${sessionId}`" class="text-sm font-semibold text-zinc-200 hover:text-[#ef233c] transition-colors" style="font-family: Manrope, sans-serif">
                {{ timelineSessions.get(sessionId)?.title || 'Unknown Session' }}
              </RouterLink>
              <span v-if="timelineSessions.get(sessionId)?.sessionNumber" class="text-xs text-zinc-600">#{{ timelineSessions.get(sessionId)!.sessionNumber }}</span>
              <span class="text-xs text-zinc-600">{{ formatSessionDate(timelineSessions.get(sessionId)?.date) }}</span>
            </div>

            <!-- Entries for this session -->
            <div class="space-y-2 pl-3 border-l-2 border-white/[0.06]">
              <div v-for="entry in entries" :key="entry.id" class="card-flat p-3">
                <div class="flex items-start gap-3">
                  <!-- Image thumbnail -->
                  <div v-if="entry.imageUrl" class="shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                    <img :src="entry.imageUrl" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span :class="['text-[0.65rem] px-1.5 py-0.5 rounded font-semibold leading-none', entryTypeConfig[entry.type]?.color || 'bg-zinc-500/15 text-zinc-400']">
                        {{ entryTypeConfig[entry.type]?.icon }} {{ entryTypeConfig[entry.type]?.label }}
                      </span>
                      <h3 class="text-sm font-semibold text-zinc-200 truncate" style="font-family: Manrope, sans-serif">{{ entry.title }}</h3>
                    </div>
                    <p v-if="entry.description" class="text-xs text-zinc-500 line-clamp-2"><MentionText :text="entry.description" /></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Feature Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showEditModal && feature" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showEditModal = false" />
          <div class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit {{ feature.name }}</h3>
              <button @click="showEditModal = false" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="label text-xs mb-1 block">Name</label>
                <input v-model="editForm.name" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Type</label>
                <TypeSelect v-model="editForm.type" :options="featureTypeOptions" input-class="w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Description</label>
                <MentionTextarea v-model="editForm.description" :rows="4" placeholder="Description..." />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button @click="showEditModal = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="savingEdit || !editForm.name.trim()" class="btn text-sm inline-flex items-center gap-1.5">
                <svg v-if="savingEdit" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {{ savingEdit ? 'Saving...' : '💾 Save' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Mini map hover popup -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-75"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="miniMapHex" class="fixed z-[100] shadow-2xl rounded-lg border border-white/10 bg-zinc-950/95 backdrop-blur-sm p-1 pointer-events-none" :style="{ left: miniMapPos.x + 'px', top: miniMapPos.y + 'px' }">
          <HexMiniMap :hexKey="miniMapHex" :width="320" />
        </div>
      </transition>
    </Teleport>
  </div>
</template>

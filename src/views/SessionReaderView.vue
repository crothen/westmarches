<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { SessionLog, SessionEntry, Npc } from '../types'

const route = useRoute()
const router = useRouter()
const sessionId = computed(() => route.params.id as string)

const session = ref<SessionLog | null>(null)
const entries = ref<SessionEntry[]>([])
const npcNames = ref<Record<string, string>>({})
const loading = ref(true)
const currentPage = ref(0)
const transitioning = ref(false)
const transitionDir = ref<'left' | 'right'>('right')

const _unsubs: (() => void)[] = []

// Entry type config for styling
const entryTypeConfig: Record<string, { icon: string; label: string; accent: string }> = {
  interaction: { icon: '🗣️', label: 'Interaction', accent: '#a855f7' },
  task: { icon: '✅', label: 'Task', accent: '#22c55e' },
  encounter: { icon: '⚔️', label: 'Encounter', accent: '#ef4444' },
  discovery: { icon: '🔍', label: 'Discovery', accent: '#3b82f6' },
  travel: { icon: '🗺️', label: 'Travel', accent: '#f59e0b' },
  rest: { icon: '🏕️', label: 'Rest', accent: '#14b8a6' },
  custom: { icon: '📝', label: 'Note', accent: '#71717a' },
}

// Total pages = cover + entries
const totalPages = computed(() => 1 + entries.value.length)
const currentEntry = computed(() => currentPage.value > 0 ? entries.value[currentPage.value - 1] ?? null : null)

// Navigate
function goToPage(page: number) {
  if (page < 0 || page >= totalPages.value || page === currentPage.value || transitioning.value) return
  transitionDir.value = page > currentPage.value ? 'right' : 'left'
  transitioning.value = true
  setTimeout(() => {
    currentPage.value = page
    setTimeout(() => { transitioning.value = false }, 50)
  }, 200)
}

function nextPage() { goToPage(currentPage.value + 1) }
function prevPage() { goToPage(currentPage.value - 1) }

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevPage() }
  else if (e.key === 'Escape') { router.push(`/sessions/${sessionId.value}`) }
}

// Format date
function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// NPC name lookup
function getNpcName(id: string): string {
  return npcNames.value[id] || 'Unknown'
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)

  // Load session
  const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId.value), (snap) => {
    if (snap.exists()) {
      session.value = { id: snap.id, ...snap.data() } as SessionLog
      loading.value = false
    }
  })
  _unsubs.push(sessionUnsub)

  // Load entries
  const entriesQ = query(
    collection(db, 'sessionEntries'),
    where('sessionId', '==', sessionId.value),
    orderBy('order', 'asc')
  )
  const entriesUnsub = onSnapshot(entriesQ, (snap) => {
    entries.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEntry))
  })
  _unsubs.push(entriesUnsub)

  // Load NPCs for name lookup
  const npcsUnsub = onSnapshot(collection(db, 'npcs'), (snap) => {
    const map: Record<string, string> = {}
    snap.docs.forEach(d => { map[d.id] = (d.data() as Npc).name })
    npcNames.value = map
  })
  _unsubs.push(npcsUnsub)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  _unsubs.forEach(fn => fn())
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none">
    <!-- Close button -->
    <button
      @click="router.push(`/sessions/${sessionId}`)"
      class="absolute top-4 right-4 z-20 text-zinc-600 hover:text-white transition-colors text-lg p-2"
      title="Close (Esc)"
    >✕</button>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-3">
      <svg class="animate-spin h-8 w-8 text-[#ef233c]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="text-zinc-500 text-sm">Loading journal...</span>
    </div>

    <!-- Journal -->
    <template v-if="!loading && session">
      <!-- Navigation arrows -->
      <button
        v-if="currentPage > 0"
        @click="prevPage"
        class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
      >‹</button>
      <button
        v-if="currentPage < totalPages - 1"
        @click="nextPage"
        class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
      >›</button>

      <!-- Page container -->
      <div
        class="relative w-full max-w-2xl mx-auto px-4"
        style="height: min(85vh, 900px)"
      >
        <!-- Page with transition -->
        <div
          :class="[
            'absolute inset-0 mx-4 rounded-2xl border border-white/[0.08] overflow-hidden transition-all duration-200',
            transitioning ? (transitionDir === 'right' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4') : 'opacity-100 translate-x-0'
          ]"
          style="background: linear-gradient(145deg, rgba(20, 16, 12, 0.95), rgba(12, 10, 8, 0.98)); box-shadow: 0 0 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)"
        >
          <!-- Subtle paper texture lines -->
          <div class="absolute inset-0 pointer-events-none opacity-[0.015]" style="background-image: repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,1) 31px, rgba(255,255,255,1) 32px)" />
          <!-- Spine shadow -->
          <div class="absolute left-0 top-0 bottom-0 w-12 pointer-events-none" style="background: linear-gradient(to right, rgba(0,0,0,0.3), transparent)" />

          <!-- COVER PAGE -->
          <div v-if="currentPage === 0" class="h-full flex flex-col">
            <!-- Cover art -->
            <div v-if="(session as any).imageUrl" class="w-full shrink-0" style="aspect-ratio: 3 / 1">
              <img :src="(session as any).imageUrl" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-full h-32 shrink-0 bg-gradient-to-br from-[#ef233c]/10 to-transparent" />

            <!-- Content -->
            <div class="flex-1 flex flex-col justify-center px-10 sm:px-14 py-8 overflow-y-auto">
              <div class="space-y-6">
                <!-- Session number -->
                <div class="text-[#ef233c]/60 text-xs font-bold tracking-[0.2em] uppercase" style="font-family: Manrope, sans-serif">
                  Session {{ session.sessionNumber }}
                </div>

                <!-- Title -->
                <h1 class="text-3xl sm:text-4xl font-bold text-zinc-100 leading-tight" style="font-family: Manrope, sans-serif">
                  {{ session.title }}
                </h1>

                <!-- Meta -->
                <div class="space-y-2 text-sm text-zinc-500">
                  <div v-if="session.date">📅 {{ formatDate(session.date) }}</div>
                  <div v-if="session.sessionLocationName">📍 {{ session.sessionLocationName }}</div>
                  <div v-if="session.dmName">🎲 DM: {{ session.dmName }}</div>
                </div>

                <!-- Participants -->
                <div v-if="session.participants?.length">
                  <div class="text-[0.65rem] text-zinc-600 uppercase tracking-wider mb-2" style="font-family: Manrope, sans-serif">Adventurers</div>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="p in session.participants" :key="p.characterId" class="text-xs bg-white/5 text-zinc-400 px-2.5 py-1 rounded-md border border-white/[0.06]">
                      {{ p.characterName }}
                    </span>
                  </div>
                </div>

                <!-- Summary -->
                <div v-if="session.summary" class="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-[#ef233c]/20 pl-4">
                  {{ session.summary }}
                </div>
              </div>
            </div>
          </div>

          <!-- ENTRY PAGES -->
          <div v-else-if="currentEntry" class="h-full flex flex-col overflow-y-auto">
            <!-- Entry image hero -->
            <div v-if="currentEntry.imageUrl" class="w-full shrink-0" style="aspect-ratio: 3 / 1">
              <img :src="currentEntry.imageUrl" class="w-full h-full object-cover" />
            </div>

            <!-- Entry content -->
            <div class="flex-1 px-10 sm:px-14 py-8">
              <!-- Type badge + title -->
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="text-xs px-2 py-0.5 rounded-md font-semibold"
                  :style="{
                    background: (entryTypeConfig[currentEntry.type]?.accent || '#71717a') + '20',
                    color: entryTypeConfig[currentEntry.type]?.accent || '#71717a'
                  }"
                >
                  {{ entryTypeConfig[currentEntry.type]?.icon }} {{ entryTypeConfig[currentEntry.type]?.label }}
                </span>
              </div>
              <h2 class="text-2xl font-bold text-zinc-100 mb-6 leading-tight" style="font-family: Manrope, sans-serif">
                {{ currentEntry.title }}
              </h2>

              <!-- Participants (if subset) -->
              <div v-if="currentEntry.allParticipantsPresent === false && currentEntry.presentParticipants?.length" class="mb-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[0.65rem] text-zinc-600 uppercase tracking-wider">Present:</span>
                  <span v-for="p in currentEntry.presentParticipants" :key="p.characterId" class="text-xs bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded">
                    {{ p.characterName }}
                  </span>
                </div>
              </div>

              <!-- Description -->
              <div v-if="currentEntry.description" class="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed mb-6">
                {{ currentEntry.description }}
              </div>

              <!-- Tags -->
              <div v-if="currentEntry.npcIds?.length || currentEntry.linkedLocationIds?.length" class="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-white/[0.04]">
                <span v-for="id in currentEntry.npcIds" :key="'npc-'+id" class="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
                  👤 {{ getNpcName(id) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Page indicators -->
      <div class="mt-4 flex items-center gap-1 z-10">
        <button
          v-for="page in totalPages"
          :key="page - 1"
          @click="goToPage(page - 1)"
          :class="[
            'transition-all duration-200 rounded-md text-xs font-medium',
            currentPage === page - 1
              ? 'bg-[#ef233c] text-white px-3 py-1 shadow-lg shadow-[#ef233c]/20'
              : 'bg-white/5 text-zinc-600 hover:text-zinc-400 hover:bg-white/10 px-2.5 py-1'
          ]"
          style="font-family: Manrope, sans-serif"
        >
          {{ page - 1 === 0 ? '📖' : page - 1 }}
        </button>
      </div>

      <!-- Page label -->
      <div class="mt-2 text-zinc-600 text-xs z-10">
        {{ currentPage === 0 ? 'Cover' : currentEntry?.title || `Page ${currentPage}` }}
      </div>
    </template>
  </div>
</template>

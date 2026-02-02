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
const showFontPicker = ref(false)

// Font options
const fonts = [
  { key: 'inter', label: 'Inter', family: "'Inter', sans-serif", importUrl: '' },
  { key: 'meow', label: 'Meow Script', family: "'Meow Script', cursive", importUrl: 'https://fonts.googleapis.com/css2?family=Meow+Script&display=swap' },
  { key: 'birthstone', label: 'Birthstone', family: "'Birthstone', cursive", importUrl: 'https://fonts.googleapis.com/css2?family=Birthstone&display=swap' },
  { key: 'fraktur', label: 'UnifrakturMaguntia', family: "'UnifrakturMaguntia', serif", importUrl: 'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap' },
  { key: 'crimson', label: 'Crimson Text', family: "'Crimson Text', serif", importUrl: 'https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap' },
  { key: 'im-fell', label: 'IM Fell English', family: "'IM Fell English', serif", importUrl: 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap' },
]
const selectedFont = ref('crimson') // nice readable default for a journal

const currentFontFamily = computed(() => {
  return fonts.find(f => f.key === selectedFont.value)?.family || "'Inter', sans-serif"
})

const _unsubs: (() => void)[] = []

// Load fonts dynamically
const loadedFonts = new Set<string>()
function ensureFontLoaded(key: string) {
  if (loadedFonts.has(key)) return
  const font = fonts.find(f => f.key === key)
  if (!font?.importUrl) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = font.importUrl
  document.head.appendChild(link)
  loadedFonts.add(key)
}

// Load all fonts on mount
onMounted(() => {
  fonts.forEach(f => ensureFontLoaded(f.key))
})

// Entry type config
const entryTypeConfig: Record<string, { icon: string; label: string; accent: string }> = {
  interaction: { icon: '🗣️', label: 'Interaction', accent: '#6b3a2a' },
  task: { icon: '✅', label: 'Task', accent: '#3a5a2a' },
  encounter: { icon: '⚔️', label: 'Encounter', accent: '#7a2a2a' },
  discovery: { icon: '🔍', label: 'Discovery', accent: '#2a4a6a' },
  travel: { icon: '🗺️', label: 'Travel', accent: '#6a5a2a' },
  rest: { icon: '🏕️', label: 'Rest', accent: '#2a5a5a' },
  custom: { icon: '📝', label: 'Note', accent: '#4a4a4a' },
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

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevPage() }
  else if (e.key === 'Escape') { router.push(`/sessions/${sessionId.value}`) }
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getNpcName(id: string): string {
  return npcNames.value[id] || 'Unknown'
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)

  const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId.value), (snap) => {
    if (snap.exists()) {
      session.value = { id: snap.id, ...snap.data() } as SessionLog
      loading.value = false
    }
  })
  _unsubs.push(sessionUnsub)

  const entriesQ = query(
    collection(db, 'sessionEntries'),
    where('sessionId', '==', sessionId.value),
    orderBy('order', 'asc')
  )
  _unsubs.push(onSnapshot(entriesQ, (snap) => {
    entries.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEntry))
  }))

  _unsubs.push(onSnapshot(collection(db, 'npcs'), (snap) => {
    const map: Record<string, string> = {}
    snap.docs.forEach(d => { map[d.id] = (d.data() as Npc).name })
    npcNames.value = map
  }))
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  _unsubs.forEach(fn => fn())
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-[#1a1410] flex flex-col items-center justify-center select-none">
    <!-- Top bar controls -->
    <div class="absolute top-4 right-4 z-20 flex items-center gap-2">
      <!-- Font picker -->
      <div class="relative">
        <button
          @click="showFontPicker = !showFontPicker"
          class="text-amber-900/40 hover:text-amber-900/70 bg-amber-100/10 hover:bg-amber-100/20 backdrop-blur text-xs px-2.5 py-1.5 rounded-lg border border-amber-900/10 transition-all"
          title="Change font"
        >
          𝐀 Font
        </button>
        <div v-if="showFontPicker" class="absolute right-0 top-full mt-1 bg-[#2a2218] border border-amber-900/20 rounded-lg shadow-xl py-1 min-w-[180px] z-30">
          <button
            v-for="font in fonts"
            :key="font.key"
            @click="selectedFont = font.key; showFontPicker = false"
            :class="[
              'w-full text-left px-3 py-2 text-sm transition-colors',
              selectedFont === font.key ? 'text-amber-200 bg-amber-900/20' : 'text-amber-100/60 hover:text-amber-100 hover:bg-amber-900/10'
            ]"
            :style="{ fontFamily: font.family }"
          >
            {{ font.label }}
          </button>
        </div>
      </div>
      <button
        @click="router.push(`/sessions/${sessionId}`)"
        class="text-amber-900/40 hover:text-amber-900/70 bg-amber-100/10 hover:bg-amber-100/20 backdrop-blur text-lg px-2 py-1 rounded-lg border border-amber-900/10 transition-all"
        title="Close (Esc)"
      >✕</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-3">
      <svg class="animate-spin h-8 w-8 text-amber-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="text-amber-900/50 text-sm">Loading journal...</span>
    </div>

    <!-- Journal -->
    <template v-if="!loading && session">
      <!-- Navigation arrows -->
      <button
        v-if="currentPage > 0"
        @click="prevPage"
        class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-amber-900/10 border border-amber-900/20 text-amber-800/40 hover:text-amber-700 hover:bg-amber-900/20 transition-all text-xl"
      >‹</button>
      <button
        v-if="currentPage < totalPages - 1"
        @click="nextPage"
        class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-amber-900/10 border border-amber-900/20 text-amber-800/40 hover:text-amber-700 hover:bg-amber-900/20 transition-all text-xl"
      >›</button>

      <!-- Page container -->
      <div class="relative w-full max-w-2xl mx-auto px-4" style="height: min(85vh, 900px)">
        <!-- Page with parchment texture -->
        <div
          :class="[
            'absolute inset-0 mx-4 rounded-xl overflow-hidden transition-all duration-200 shadow-2xl',
            transitioning ? (transitionDir === 'right' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4') : 'opacity-100 translate-x-0'
          ]"
          style="box-shadow: 0 4px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,90,43,0.15)"
        >
          <!-- Parchment background -->
          <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/textures/parchment.jpg')" />
          <!-- Slight vignette overlay -->
          <div class="absolute inset-0" style="background: radial-gradient(ellipse at center, transparent 50%, rgba(60,40,20,0.15) 100%)" />
          <!-- Spine shadow -->
          <div class="absolute left-0 top-0 bottom-0 w-10 pointer-events-none" style="background: linear-gradient(to right, rgba(80,50,20,0.2), transparent)" />

          <!-- COVER PAGE -->
          <div v-if="currentPage === 0" class="relative h-full flex flex-col">
            <!-- Cover art -->
            <div v-if="(session as any).imageUrl" class="w-full shrink-0 border-b border-amber-900/15" style="aspect-ratio: 3 / 1">
              <img :src="(session as any).imageUrl" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-full h-24 shrink-0 bg-gradient-to-br from-amber-900/10 to-transparent" />

            <!-- Content -->
            <div class="flex-1 flex flex-col justify-center px-10 sm:px-14 py-8 overflow-y-auto">
              <div class="space-y-5" :style="{ fontFamily: currentFontFamily }">
                <!-- Session number -->
                <div class="text-amber-900/40 text-xs font-bold tracking-[0.2em] uppercase" style="font-family: Manrope, sans-serif">
                  Session {{ session.sessionNumber }}
                </div>

                <!-- Title -->
                <h1 class="text-3xl sm:text-4xl font-bold text-amber-950/90 leading-tight" :style="{ fontFamily: currentFontFamily }">
                  {{ session.title }}
                </h1>

                <!-- Meta -->
                <div class="space-y-1.5 text-sm text-amber-900/60" :style="{ fontFamily: currentFontFamily }">
                  <div v-if="session.date">📅 {{ formatDate(session.date) }}</div>
                  <div v-if="session.sessionLocationName">📍 {{ session.sessionLocationName }}</div>
                  <div v-if="session.dmName">🎲 DM: {{ session.dmName }}</div>
                </div>

                <!-- Participants -->
                <div v-if="session.participants?.length">
                  <div class="text-[0.65rem] text-amber-900/40 uppercase tracking-wider mb-2" style="font-family: Manrope, sans-serif">Adventurers</div>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="p in session.participants" :key="p.characterId" class="text-xs bg-amber-900/8 text-amber-900/70 px-2.5 py-1 rounded-md border border-amber-900/10" :style="{ fontFamily: currentFontFamily }">
                      {{ p.characterName }}
                    </span>
                  </div>
                </div>

                <!-- Summary -->
                <div v-if="session.summary" class="text-sm text-amber-900/70 leading-relaxed italic border-l-2 border-amber-800/20 pl-4" :style="{ fontFamily: currentFontFamily }">
                  {{ session.summary }}
                </div>
              </div>
            </div>
          </div>

          <!-- ENTRY PAGES -->
          <div v-else-if="currentEntry" class="relative h-full flex flex-col overflow-y-auto">
            <!-- Entry image hero -->
            <div v-if="currentEntry.imageUrl" class="w-full shrink-0 border-b border-amber-900/15" style="aspect-ratio: 3 / 1">
              <img :src="currentEntry.imageUrl" class="w-full h-full object-cover" />
            </div>

            <!-- Entry content -->
            <div class="flex-1 px-10 sm:px-14 py-8" :style="{ fontFamily: currentFontFamily }">
              <!-- Type badge -->
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="text-xs px-2 py-0.5 rounded-md font-semibold border"
                  :style="{
                    background: (entryTypeConfig[currentEntry.type]?.accent || '#4a4a4a') + '15',
                    color: entryTypeConfig[currentEntry.type]?.accent || '#4a4a4a',
                    borderColor: (entryTypeConfig[currentEntry.type]?.accent || '#4a4a4a') + '30',
                    fontFamily: 'Manrope, sans-serif'
                  }"
                >
                  {{ entryTypeConfig[currentEntry.type]?.icon }} {{ entryTypeConfig[currentEntry.type]?.label }}
                </span>
              </div>

              <!-- Title -->
              <h2 class="text-2xl font-bold text-amber-950/90 mb-5 leading-tight" :style="{ fontFamily: currentFontFamily }">
                {{ currentEntry.title }}
              </h2>

              <!-- Participants (if subset) -->
              <div v-if="currentEntry.allParticipantsPresent === false && currentEntry.presentParticipants?.length" class="mb-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[0.65rem] text-amber-900/40 uppercase tracking-wider" style="font-family: Manrope, sans-serif">Present:</span>
                  <span v-for="p in currentEntry.presentParticipants" :key="p.characterId" class="text-xs bg-amber-900/8 text-amber-900/60 px-1.5 py-0.5 rounded border border-amber-900/10">
                    {{ p.characterName }}
                  </span>
                </div>
              </div>

              <!-- Description -->
              <div v-if="currentEntry.description" class="text-[0.95rem] text-amber-950/80 whitespace-pre-wrap leading-relaxed mb-6">
                {{ currentEntry.description }}
              </div>

              <!-- NPC tags -->
              <div v-if="currentEntry.npcIds?.length" class="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-amber-900/10">
                <span v-for="id in currentEntry.npcIds" :key="'npc-'+id" class="text-xs bg-amber-900/8 text-amber-900/60 px-2 py-0.5 rounded-md border border-amber-900/10">
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
              ? 'bg-amber-800 text-amber-100 px-3 py-1 shadow-lg shadow-amber-900/30'
              : 'bg-amber-900/15 text-amber-800/40 hover:text-amber-700 hover:bg-amber-900/25 px-2.5 py-1'
          ]"
          style="font-family: Manrope, sans-serif"
        >
          {{ page - 1 === 0 ? '📖' : page - 1 }}
        </button>
      </div>

      <!-- Page label -->
      <div class="mt-2 text-amber-800/30 text-xs z-10">
        {{ currentPage === 0 ? 'Cover' : currentEntry?.title || `Page ${currentPage}` }}
      </div>
    </template>
  </div>
</template>

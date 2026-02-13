<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
const isFullscreen = ref(false)

// Touch handling
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchStartTime = ref(0)

// Sketch image cache: entryId/cover → objectUrl
const sketchCache = ref<Record<string, string>>({})

// Font options
const fonts = [
  { key: 'crimson', label: 'Crimson Text', family: "'Crimson Text', serif", importUrl: 'https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap' },
  { key: 'im-fell', label: 'IM Fell English', family: "'IM Fell English', serif", importUrl: 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap' },
  { key: 'meow', label: 'Meow Script', family: "'Meow Script', cursive", importUrl: 'https://fonts.googleapis.com/css2?family=Meow+Script&display=swap' },
  { key: 'birthstone', label: 'Birthstone', family: "'Birthstone', cursive", importUrl: 'https://fonts.googleapis.com/css2?family=Birthstone&display=swap' },
  { key: 'fraktur', label: 'UnifrakturMaguntia', family: "'UnifrakturMaguntia', serif", importUrl: 'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap' },
  { key: 'inter', label: 'Inter', family: "'Inter', sans-serif", importUrl: '' },
]
const selectedFont = ref('fraktur')

const currentFontFamily = computed(() => {
  return fonts.find(f => f.key === selectedFont.value)?.family || "'Meow Script', cursive"
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

// --- Canny edge detection for sketch effect ---
function toSketch(imageUrl: string, cacheKey: string) {
  if (sketchCache.value[cacheKey]) return // already cached
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    // Scale down for performance (max 600px wide)
    const scale = Math.min(1, 1200 / img.naturalWidth)
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)

    const imageData = ctx.getImageData(0, 0, w, h)
    const gray = new Float32Array(w * h)

    // 1. Grayscale
    for (let i = 0; i < w * h; i++) {
      const r = imageData.data[i * 4]!
      const g = imageData.data[i * 4 + 1]!
      const b = imageData.data[i * 4 + 2]!
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
    }

    // 2. Gaussian blur (5x5) to reduce noise
    const blurred = gaussianBlur(gray, w, h)

    // 3. Sobel gradient magnitude (no Canny — pure Sobel filter)
    const magnitude = new Float32Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx =
          -blurred[(y-1)*w+(x-1)]! - 2*blurred[y*w+(x-1)]! - blurred[(y+1)*w+(x-1)]! +
           blurred[(y-1)*w+(x+1)]! + 2*blurred[y*w+(x+1)]! + blurred[(y+1)*w+(x+1)]!
        const gy =
          -blurred[(y-1)*w+(x-1)]! - 2*blurred[(y-1)*w+x]! - blurred[(y-1)*w+(x+1)]! +
           blurred[(y+1)*w+(x-1)]! + 2*blurred[(y+1)*w+x]! + blurred[(y+1)*w+(x+1)]!
        magnitude[y * w + x] = Math.sqrt(gx * gx + gy * gy)
      }
    }

    // 4. Render: variable-weight ink lines based on gradient strength
    //    Normalize magnitude, then map to alpha with a threshold
    let maxMag = 0
    for (let i = 0; i < w * h; i++) { if (magnitude[i]! > maxMag) maxMag = magnitude[i]! }
    if (maxMag < 1) maxMag = 1

    const output = ctx.createImageData(w, h)
    const threshold = 0.04 // ignore very faint gradients
    for (let i = 0; i < w * h; i++) {
      const norm = magnitude[i]! / maxMag
      if (norm < threshold) {
        output.data[i * 4 + 3] = 0
        continue
      }
      // Remap: threshold..1 → 0..1, then apply gamma for bolder lines
      const t = (norm - threshold) / (1 - threshold)
      const gamma = Math.pow(t, 0.5) // sqrt gamma = bolder mid-range
      const alpha = Math.round(gamma * 255)
      output.data[i * 4] = 15
      output.data[i * 4 + 1] = 10
      output.data[i * 4 + 2] = 5
      output.data[i * 4 + 3] = alpha
    }
    ctx.putImageData(output, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        sketchCache.value[cacheKey] = URL.createObjectURL(blob)
      }
    })
  }
  img.src = imageUrl
}

function gaussianBlur(src: Float32Array, w: number, h: number): Float32Array {
  const kernel = [1, 4, 6, 4, 1]
  const kSum = 16 // sum of 1D kernel (normalize by kSum twice for 2D)
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -2; k <= 2; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k))
        sum += src[y * w + xx]! * kernel[k + 2]!
      }
      tmp[y * w + x] = sum / kSum
    }
  }
  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -2; k <= 2; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k))
        sum += tmp[yy * w + x]! * kernel[k + 2]!
      }
      out[y * w + x] = sum / kSum
    }
  }
  return out
}

const totalPages = computed(() => 1 + entries.value.length)
const currentEntry = computed(() => currentPage.value > 0 ? entries.value[currentPage.value - 1] ?? null : null)

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
  else if (e.key === 'Escape') { exitFullscreenAndClose() }
}

// Fullscreen handling
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(() => {})
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    }).catch(() => {})
  }
}

function exitFullscreenAndClose() {
  if (document.fullscreenElement) {
    document.exitFullscreen().then(() => {
      router.push(`/sessions/${sessionId.value}`)
    })
  } else {
    router.push(`/sessions/${sessionId.value}`)
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// Touch handling for swipe navigation
function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  touchStartTime.value = Date.now()
}

function onTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return

  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value
  const deltaTime = Date.now() - touchStartTime.value

  // Require a minimum swipe distance and speed, and mostly horizontal
  const minSwipeDistance = 50
  const maxSwipeTime = 300
  const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5

  if (Math.abs(deltaX) > minSwipeDistance && deltaTime < maxSwipeTime && isHorizontal) {
    if (deltaX < 0) {
      nextPage()
    } else {
      prevPage()
    }
  }
}

// Prevent default touch behaviors (pull-to-refresh, back gesture, etc.)
function preventDefaultTouch(e: TouchEvent) {
  // Allow vertical scrolling within the page content
  const target = e.target as HTMLElement
  if (target?.closest('.overflow-y-auto')) return
  e.preventDefault()
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getNpcName(id: string): string {
  return npcNames.value[id] || 'Unknown'
}

// Strip @[Name](type:id) mention syntax to just the name
function stripMentions(text: string): string {
  return text.replace(/[@#¦]\[([^\]]+)\]\((char|npc|location|feature|pin|org):[^)]+\)/g, '$1')
}

// Generate sketches for all images when data loads
function generateSketches() {
  if (session.value && (session.value as any).imageUrl) {
    toSketch((session.value as any).imageUrl, 'cover')
  }
  entries.value.forEach(e => {
    if (e.imageUrl) toSketch(e.imageUrl, e.id)
  })
}

watch([session, entries], generateSketches, { deep: true })

onMounted(() => {
  fonts.forEach(f => ensureFontLoaded(f.key))
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  // Prevent browser back gesture and pull-to-refresh
  document.body.style.overscrollBehavior = 'none'

  _unsubs.push(onSnapshot(doc(db, 'sessions', sessionId.value), (snap) => {
    if (snap.exists()) {
      session.value = { id: snap.id, ...snap.data() } as SessionLog
      loading.value = false
    }
  }))

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
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.body.style.overscrollBehavior = ''
  _unsubs.forEach(fn => fn())
  // Revoke sketch blob URLs
  Object.values(sketchCache.value).forEach(url => URL.revokeObjectURL(url))
  // Exit fullscreen if active
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 bg-[#1a1410] flex flex-col items-center justify-center select-none pt-[env(safe-area-inset-top,0px)] touch-pan-y"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
    @touchmove="preventDefaultTouch"
  >
    <!-- Top bar controls -->
    <div class="absolute top-4 right-4 z-20 flex items-center gap-2 mt-[env(safe-area-inset-top,0px)]">
      <!-- Font picker -->
      <div class="relative">
        <button
          @click="showFontPicker = !showFontPicker"
          class="text-zinc-300 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm text-sm px-3.5 py-2 rounded-lg border border-white/15 transition-all"
          title="Change font"
        >Font</button>
        <div v-if="showFontPicker" class="absolute right-0 top-full mt-1 bg-zinc-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[200px] z-30">
          <button
            v-for="font in fonts"
            :key="font.key"
            @click="selectedFont = font.key; showFontPicker = false"
            :class="[
              'w-full text-left px-4 py-2.5 text-base transition-colors',
              selectedFont === font.key ? 'text-white bg-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            ]"
            :style="{ fontFamily: font.family }"
          >
            {{ font.label }}
          </button>
        </div>
      </div>
      <!-- Fullscreen toggle -->
      <button
        @click="toggleFullscreen"
        class="text-zinc-300 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm text-lg w-10 h-10 flex items-center justify-center rounded-lg border border-white/15 transition-all"
        :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
      >
        <svg v-if="!isFullscreen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4H4m0 5l5-5m6 5h5V4m-5 5l5-5M9 15v5H4m5-5l-5 5m11-5h5v5m-5-5l5 5" />
        </svg>
      </button>
      <button
        @click="exitFullscreenAndClose"
        class="text-zinc-300 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm text-lg w-10 h-10 flex items-center justify-center rounded-lg border border-white/15 transition-all"
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
        class="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/15 text-zinc-300 hover:text-white transition-all text-2xl"
      >&lsaquo;</button>
      <button
        v-if="currentPage < totalPages - 1"
        @click="nextPage"
        class="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/15 text-zinc-300 hover:text-white transition-all text-2xl"
      >&rsaquo;</button>

      <!-- Page container -->
      <div class="relative w-full max-w-2xl mx-auto px-4" style="height: min(85vh, 900px)">
        <div
          :class="[
            'absolute inset-0 mx-4 rounded-xl overflow-hidden transition-all duration-200 shadow-2xl',
            transitioning ? (transitionDir === 'right' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4') : 'opacity-100 translate-x-0'
          ]"
          style="box-shadow: 0 4px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,90,43,0.15)"
        >
          <!-- Parchment background -->
          <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/textures/parchment.jpg')" />
          <div class="absolute inset-0" style="background: radial-gradient(ellipse at center, transparent 50%, rgba(60,40,20,0.15) 100%)" />
          <div class="absolute left-0 top-0 bottom-0 w-10 pointer-events-none" style="background: linear-gradient(to right, rgba(80,50,20,0.2), transparent)" />

          <!-- ==================== COVER PAGE ==================== -->
          <div v-if="currentPage === 0" class="relative h-full flex flex-col overflow-y-auto">
            <!-- Title at top -->
            <div class="px-10 sm:px-14 pt-8 pb-2" :style="{ fontFamily: currentFontFamily }">
              <h1 class="text-2xl sm:text-3xl font-bold text-amber-950 leading-tight" :style="{ fontFamily: currentFontFamily }">
                {{ session.title }}
              </h1>
            </div>

            <!-- Sketch cover image with faded edges -->
            <div v-if="sketchCache['cover'] || (session as any).imageUrl" class="w-full relative">
              <img
                :src="sketchCache['cover'] || (session as any).imageUrl"
                class="w-full object-contain cover-fade"
                :style="sketchCache['cover'] ? '' : 'filter: grayscale(1) contrast(1.5)'"
              />
            </div>

            <div class="flex-1 flex flex-col justify-center px-10 sm:px-14 py-6" :style="{ fontFamily: currentFontFamily }">
              <div class="space-y-4">
                <!-- Separator -->
                <div class="w-24 border-t border-amber-900/20" />

                <!-- Meta as plain text lines -->
                <div class="journal-text space-y-1" :style="{ fontFamily: currentFontFamily }">
                  <div v-if="session.date">{{ formatDate(session.date) }}</div>
                  <div v-if="session.sessionLocationName">{{ session.sessionLocationName }}</div>
                  <div v-if="session.dmName">Dungeon Master: {{ session.dmName }}</div>
                </div>

                <!-- Adventurers as tilde-separated list -->
                <div v-if="session.participants?.length" :style="{ fontFamily: currentFontFamily }">
                  <div class="journal-text mb-1" style="font-size: 1.8rem" :style="{ fontFamily: currentFontFamily }">Adventurers</div>
                  <div class="journal-text">
                    <template v-for="(p, i) in session.participants" :key="p.characterId">
                      {{ p.characterName }}<template v-if="i < session.participants.length - 1"> ~ </template>
                    </template>
                  </div>
                </div>

                <!-- Summary as italic block -->
                <div v-if="session.summary" class="journal-text italic border-l-2 border-amber-900/15 pl-4 mt-4 !leading-relaxed" :style="{ fontFamily: currentFontFamily }">
                  {{ stripMentions(session.summary) }}
                </div>
              </div>
            </div>
          </div>

          <!-- ==================== ENTRY PAGES ==================== -->
          <div v-else-if="currentEntry" class="relative h-full flex flex-col overflow-y-auto">
            <!-- Title above image, centered -->
            <div class="px-10 sm:px-14 pt-6 pb-2 text-center" :style="{ fontFamily: currentFontFamily }">
              <h2 class="text-4xl text-amber-950 leading-tight" :style="{ fontFamily: currentFontFamily }">
                {{ currentEntry.title }}
              </h2>
            </div>

            <!-- Sketch image (centered, compact) -->
            <div v-if="sketchCache[currentEntry.id] || currentEntry.imageUrl" class="flex justify-center px-4 py-2">
              <img
                :src="sketchCache[currentEntry.id] || currentEntry.imageUrl"
                class="w-[65%] object-contain sketch-fade"
                :style="sketchCache[currentEntry.id] ? '' : 'filter: grayscale(1) contrast(1.5)'"
              />
            </div>

            <div class="flex-1 px-10 sm:px-14 py-4" :style="{ fontFamily: currentFontFamily }">
              <!-- Separator -->
              <div class="w-16 border-t border-amber-900/15 mb-4 mx-auto" />

              <!-- Participants (if subset) -->
              <div v-if="currentEntry.allParticipantsPresent === false && currentEntry.presentParticipants?.length" class="journal-text mb-4 italic">
                Present: <template v-for="(p, i) in currentEntry.presentParticipants" :key="p.characterId">{{ p.characterName }}<template v-if="i < currentEntry.presentParticipants.length - 1">, </template></template>
              </div>

              <!-- Description -->
              <div v-if="currentEntry.description" class="journal-text whitespace-pre-wrap !leading-relaxed mb-6">
                {{ stripMentions(currentEntry.description) }}
              </div>

              <!-- People of Interest -->
              <div v-if="currentEntry.npcIds?.length" class="mt-auto pt-4 border-t border-amber-900/10">
                <div class="journal-text mb-1" style="font-size: 1.8rem" :style="{ fontFamily: currentFontFamily }">People of Interest</div>
                <div class="journal-text">
                  <template v-for="(id, i) in currentEntry.npcIds" :key="id">
                    {{ getNpcName(id) }}<template v-if="i < currentEntry.npcIds.length - 1"> ~ </template>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Page indicators -->
      <div class="mt-4 flex items-center gap-1.5 z-10">
        <button
          v-for="page in totalPages"
          :key="page - 1"
          @click="goToPage(page - 1)"
          :class="[
            'transition-all duration-200 rounded-lg text-sm font-medium',
            currentPage === page - 1
              ? 'bg-amber-700 text-white px-3.5 py-1.5 shadow-lg ring-2 ring-amber-500/50'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 px-3 py-1.5'
          ]"
          style="font-family: Manrope, sans-serif"
        >
          {{ page - 1 === 0 ? 'Cover' : page - 1 }}
        </button>
      </div>

      <!-- Page label -->
      <div class="mt-2 text-zinc-500 text-sm z-10" :style="{ fontFamily: currentFontFamily }">
        {{ currentPage === 0 ? session.title : currentEntry?.title || '' }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.sketch-fade {
  mask-image: radial-gradient(ellipse 90% 85% at center, black 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 90% 85% at center, black 40%, transparent 100%);
}

.cover-fade {
  mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
}

.journal-text {
  font-weight: bold;
  color: #1c0d03;
  opacity: 0.9;
  font-size: 1.5rem;
  line-height: 1 !important;
}

/* Prevent overscroll/bounce and back gesture on mobile */
:deep(.fixed) {
  overscroll-behavior: none;
  -webkit-overflow-scrolling: auto;
}

/* Disable touch-action for horizontal swipes on main container */
.touch-pan-y {
  touch-action: pan-y pinch-zoom;
  overscroll-behavior-x: none;
}
</style>

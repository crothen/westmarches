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
const selectedFont = ref('meow')

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
    const scale = Math.min(1, 600 / img.naturalWidth)
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

    // 2. Gaussian blur (5x5 approximation)
    const blurred = gaussianBlur(gray, w, h)

    // 3. Sobel gradient magnitude + direction
    const { magnitude, direction } = sobelGradient(blurred, w, h)

    // 4. Non-maximum suppression
    const suppressed = nonMaxSuppression(magnitude, direction, w, h)

    // 5. Double threshold + hysteresis
    const edges = hysteresis(suppressed, w, h, 25, 60)

    // 6. Render: dark lines on transparent (will show parchment through)
    const output = ctx.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const edge = edges[i]!
      // Invert: edges become dark lines, rest is transparent
      const alpha = edge ? 200 : 0
      output.data[i * 4] = 40       // dark brown-ish ink
      output.data[i * 4 + 1] = 30
      output.data[i * 4 + 2] = 20
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

function sobelGradient(src: Float32Array, w: number, h: number) {
  const magnitude = new Float32Array(w * h)
  const direction = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -src[(y-1)*w+(x-1)]! - 2*src[y*w+(x-1)]! - src[(y+1)*w+(x-1)]! +
         src[(y-1)*w+(x+1)]! + 2*src[y*w+(x+1)]! + src[(y+1)*w+(x+1)]!
      const gy =
        -src[(y-1)*w+(x-1)]! - 2*src[(y-1)*w+x]! - src[(y-1)*w+(x+1)]! +
         src[(y+1)*w+(x-1)]! + 2*src[(y+1)*w+x]! + src[(y+1)*w+(x+1)]!
      magnitude[y * w + x] = Math.sqrt(gx * gx + gy * gy)
      direction[y * w + x] = Math.atan2(gy, gx)
    }
  }
  return { magnitude, direction }
}

function nonMaxSuppression(mag: Float32Array, dir: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const angle = ((dir[idx]! * 180 / Math.PI) + 180) % 180
      let n1 = 0, n2 = 0
      if (angle < 22.5 || angle >= 157.5) { n1 = mag[idx + 1]!; n2 = mag[idx - 1]! }
      else if (angle < 67.5) { n1 = mag[(y-1)*w+(x+1)]!; n2 = mag[(y+1)*w+(x-1)]! }
      else if (angle < 112.5) { n1 = mag[(y-1)*w+x]!; n2 = mag[(y+1)*w+x]! }
      else { n1 = mag[(y-1)*w+(x-1)]!; n2 = mag[(y+1)*w+(x+1)]! }
      out[idx] = (mag[idx]! >= n1 && mag[idx]! >= n2) ? mag[idx]! : 0
    }
  }
  return out
}

function hysteresis(sup: Float32Array, w: number, h: number, lo: number, hi: number): Uint8Array {
  const out = new Uint8Array(w * h) // 0 or 1
  const stack: number[] = []
  // Mark strong edges
  for (let i = 0; i < w * h; i++) {
    if (sup[i]! >= hi) { out[i] = 1; stack.push(i) }
  }
  // Grow from strong edges to weak edges
  while (stack.length) {
    const idx = stack.pop()!
    const x = idx % w, y = (idx - x) / w
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const ni = ny * w + nx
          if (!out[ni] && sup[ni]! >= lo) { out[ni] = 1; stack.push(ni) }
        }
      }
    }
  }
  return out
}

// Entry type labels (no icons)
const entryTypeLabels: Record<string, string> = {
  interaction: 'Interaction',
  task: 'Task',
  encounter: 'Encounter',
  discovery: 'Discovery',
  travel: 'Travel',
  rest: 'Rest',
  custom: 'Note',
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
  _unsubs.forEach(fn => fn())
  // Revoke sketch blob URLs
  Object.values(sketchCache.value).forEach(url => URL.revokeObjectURL(url))
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
        >Font</button>
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
      >&lsaquo;</button>
      <button
        v-if="currentPage < totalPages - 1"
        @click="nextPage"
        class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-amber-900/10 border border-amber-900/20 text-amber-800/40 hover:text-amber-700 hover:bg-amber-900/20 transition-all text-xl"
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
            <!-- Sketch cover image (centered, smaller) -->
            <div v-if="sketchCache['cover'] || (session as any).imageUrl" class="flex justify-center pt-8 px-10">
              <img
                :src="sketchCache['cover'] || (session as any).imageUrl"
                class="max-w-[70%] max-h-[200px] object-contain"
                :style="sketchCache['cover'] ? '' : 'filter: grayscale(1) contrast(1.5)'"
              />
            </div>

            <div class="flex-1 flex flex-col justify-center px-10 sm:px-14 py-6" :style="{ fontFamily: currentFontFamily }">
              <div class="space-y-4">
                <!-- Session number as handwritten label -->
                <div class="text-amber-950/30 text-xs tracking-[0.15em] uppercase" style="font-family: Manrope, sans-serif">
                  Session {{ session.sessionNumber }}
                </div>

                <!-- Title -->
                <h1 class="text-3xl sm:text-4xl text-amber-950 leading-tight" :style="{ fontFamily: currentFontFamily }">
                  {{ session.title }}
                </h1>

                <!-- Separator -->
                <div class="w-24 border-t border-amber-900/20" />

                <!-- Meta as plain text lines -->
                <div class="text-sm text-amber-950/70 space-y-1" :style="{ fontFamily: currentFontFamily }">
                  <div v-if="session.date">{{ formatDate(session.date) }}</div>
                  <div v-if="session.sessionLocationName">{{ session.sessionLocationName }}</div>
                  <div v-if="session.dmName">Dungeon Master: {{ session.dmName }}</div>
                </div>

                <!-- Adventurers as tilde-separated list -->
                <div v-if="session.participants?.length" :style="{ fontFamily: currentFontFamily }">
                  <div class="text-amber-950/40 text-xs italic mb-1">Adventurers</div>
                  <div class="text-sm text-amber-950/80">
                    <template v-for="(p, i) in session.participants" :key="p.characterId">
                      {{ p.characterName }}<template v-if="i < session.participants.length - 1"> ~ </template>
                    </template>
                  </div>
                </div>

                <!-- Summary as italic block -->
                <div v-if="session.summary" class="text-sm text-amber-950/65 leading-relaxed italic border-l-2 border-amber-900/15 pl-4 mt-4" :style="{ fontFamily: currentFontFamily }">
                  {{ session.summary }}
                </div>
              </div>
            </div>
          </div>

          <!-- ==================== ENTRY PAGES ==================== -->
          <div v-else-if="currentEntry" class="relative h-full flex flex-col overflow-y-auto">
            <!-- Sketch image (centered, compact) -->
            <div v-if="sketchCache[currentEntry.id] || currentEntry.imageUrl" class="flex justify-center pt-6 px-10">
              <img
                :src="sketchCache[currentEntry.id] || currentEntry.imageUrl"
                class="max-w-[60%] max-h-[180px] object-contain"
                :style="sketchCache[currentEntry.id] ? '' : 'filter: grayscale(1) contrast(1.5)'"
              />
            </div>

            <div class="flex-1 px-10 sm:px-14 py-6" :style="{ fontFamily: currentFontFamily }">
              <!-- Type label -->
              <div class="text-amber-950/30 text-xs italic mb-1">
                {{ entryTypeLabels[currentEntry.type] || 'Note' }}
              </div>

              <!-- Title -->
              <h2 class="text-2xl text-amber-950 mb-4 leading-tight" :style="{ fontFamily: currentFontFamily }">
                {{ currentEntry.title }}
              </h2>

              <!-- Separator -->
              <div class="w-16 border-t border-amber-900/15 mb-4" />

              <!-- Participants (if subset) -->
              <div v-if="currentEntry.allParticipantsPresent === false && currentEntry.presentParticipants?.length" class="text-sm text-amber-950/60 mb-4 italic">
                Present: <template v-for="(p, i) in currentEntry.presentParticipants" :key="p.characterId">{{ p.characterName }}<template v-if="i < currentEntry.presentParticipants.length - 1">, </template></template>
              </div>

              <!-- Description -->
              <div v-if="currentEntry.description" class="text-[0.95rem] text-amber-950/85 whitespace-pre-wrap leading-relaxed mb-6">
                {{ currentEntry.description }}
              </div>

              <!-- People of Interest -->
              <div v-if="currentEntry.npcIds?.length" class="mt-auto pt-4 border-t border-amber-900/10">
                <div class="text-amber-950/40 text-xs italic mb-1">People of Interest</div>
                <div class="text-sm text-amber-950/70">
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
          {{ page - 1 === 0 ? 'Cover' : page - 1 }}
        </button>
      </div>

      <!-- Page label -->
      <div class="mt-2 text-amber-800/30 text-xs z-10" :style="{ fontFamily: currentFontFamily }">
        {{ currentPage === 0 ? session.title : currentEntry?.title || '' }}
      </div>
    </template>
  </div>
</template>

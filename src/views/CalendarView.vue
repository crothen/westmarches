<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, doc, query, orderBy, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { SessionLog, Character } from '../types'

interface CampaignConfig {
  startDate?: string  // YYYY-MM-DD
}

const auth = useAuthStore()
const sessions = ref<SessionLog[]>([])
const characters = ref<Character[]>([])
const config = ref<CampaignConfig>({})
const loading = ref(true)
const currentMonth = ref(new Date().getMonth())  // 0-11
const currentYear = ref(new Date().getFullYear())
const _unsubs: (() => void)[] = []

onMounted(() => {
  // Load campaign config
  _unsubs.push(onSnapshot(doc(db, 'config', 'campaign'), (snap) => {
    if (snap.exists()) {
      config.value = snap.data() as CampaignConfig
      // Set initial view to campaign start if available
      if (config.value.startDate) {
        const [year, month] = config.value.startDate.split('-').map(Number)
        if (year && month) {
          currentYear.value = year
          currentMonth.value = month - 1  // 0-indexed
        }
      }
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load campaign config:', e)
    loading.value = false
  }))

  // Load sessions
  _unsubs.push(onSnapshot(query(collection(db, 'sessions'), orderBy('sessionNumber', 'asc')), (snap) => {
    sessions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionLog))
  }, (e) => console.error('Failed to load sessions:', e)))

  // Load characters
  _unsubs.push(onSnapshot(collection(db, 'characters'), (snap) => {
    characters.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
  }, (e) => console.error('Failed to load characters:', e)))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const daysInMonth = computed(() => new Date(currentYear.value, currentMonth.value + 1, 0).getDate())
const firstDayOfWeek = computed(() => new Date(currentYear.value, currentMonth.value, 1).getDay())

// Get sessions that occur in the current month
const sessionsInMonth = computed(() => {
  return sessions.value.filter(s => {
    if (!s.inGameStartDate) return false
    const [year, month] = s.inGameStartDate.split('-').map(Number)
    return year === currentYear.value && month === currentMonth.value + 1
  })
})

// Parse YYYY-MM-DD to { year, month, day }
function parseDate(dateStr: string): { year: number; month: number; day: number } | null {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  const [year, month, day] = parts as [number, number, number]
  return { year, month, day }
}

// Convert to comparable number (for date math)
function dateToNum(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day
}

// Get sessions for a specific day
function getSessionsForDay(day: number): SessionLog[] {
  const checkNum = dateToNum(currentYear.value, currentMonth.value + 1, day)
  
  return sessions.value.filter(s => {
    if (!s.inGameStartDate) return false
    const start = parseDate(s.inGameStartDate)
    if (!start) return false
    
    const startNum = dateToNum(start.year, start.month, start.day)
    const duration = s.inGameDurationDays || 1
    
    // Calculate end date (simple day addition - doesn't handle month overflow perfectly but good enough)
    let endDay = start.day + duration - 1
    let endMonth = start.month
    let endYear = start.year
    
    // Simple overflow handling
    const daysInStartMonth = new Date(2000, start.month, 0).getDate() // use 2000 as proxy year
    while (endDay > daysInStartMonth) {
      endDay -= daysInStartMonth
      endMonth++
      if (endMonth > 12) {
        endMonth = 1
        endYear++
      }
    }
    
    const endNum = dateToNum(endYear, endMonth, endDay)
    return checkNum >= startNum && checkNum <= endNum
  })
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

// Calculate downtime for a character
function getDowntimeDays(character: Character): number {
  let totalDowntime = 0
  const sortedSessions = [...sessions.value]
    .filter(s => s.inGameStartDate)
    .sort((a, b) => a.inGameStartDate!.localeCompare(b.inGameStartDate!))
  
  for (const session of sortedSessions) {
    const wasPresent = session.participants?.some(p => p.characterId === character.id)
    if (!wasPresent) {
      totalDowntime += session.inGameDurationDays || 1
    }
  }
  return totalDowntime
}

function getAvailableDowntime(character: Character): number {
  return getDowntimeDays(character) - (character.downtimeDaysUsed || 0)
}

// All active characters sorted by name
const activeCharacters = computed(() => {
  return characters.value
    .filter(c => c.isActive)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
})

// Check if user can edit a character's downtime
function canEditDowntime(character: Character): boolean {
  if (auth.isAdmin || auth.isDm) return true
  return character.userId === auth.firebaseUser?.uid
}

// Downtime editing state
const editingDowntimeCharacterId = ref<string | null>(null)
const newDowntimeUsed = ref(0)
const savingDowntime = ref(false)

function startEditDowntime(character: Character) {
  editingDowntimeCharacterId.value = character.id
  newDowntimeUsed.value = character.downtimeDaysUsed || 0
}

function cancelEditDowntime() {
  editingDowntimeCharacterId.value = null
}

async function saveDowntime(character: Character) {
  savingDowntime.value = true
  try {
    await updateDoc(doc(db, 'characters', character.id), {
      downtimeDaysUsed: newDowntimeUsed.value,
      updatedAt: new Date(),
    })
    editingDowntimeCharacterId.value = null
  } catch (e) {
    console.error('Failed to save downtime:', e)
    alert('Failed to save.')
  } finally {
    savingDowntime.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-white mb-6" style="font-family: Manrope, sans-serif">📅 Campaign Calendar</h1>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading calendar...</div>

    <!-- Calendar -->
    <div v-else class="card p-5 mb-6 relative z-10">
      <div class="relative z-10">
        <!-- Month Navigation -->
        <div class="flex items-center justify-between mb-4">
          <button @click="prevMonth" class="text-zinc-500 hover:text-white transition-colors px-3 py-1">← Prev</button>
          <h2 class="text-xl font-bold text-zinc-200" style="font-family: Manrope, sans-serif">
            {{ monthNames[currentMonth] }} {{ currentYear }}
          </h2>
          <button @click="nextMonth" class="text-zinc-500 hover:text-white transition-colors px-3 py-1">Next →</button>
        </div>

        <!-- Day Headers -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day" class="text-center text-xs text-zinc-600 font-semibold py-1">
            {{ day }}
          </div>
        </div>

        <!-- Calendar Grid -->
        <div class="grid grid-cols-7 gap-1">
          <!-- Empty cells for days before month starts -->
          <div v-for="n in firstDayOfWeek" :key="'empty-' + n" class="aspect-square" />
          
          <!-- Day cells -->
          <div
            v-for="day in daysInMonth"
            :key="day"
            :class="[
              'aspect-square rounded-lg border transition-colors p-1 min-h-[60px]',
              getSessionsForDay(day).length > 0 ? 'border-[#ef233c]/30 bg-[#ef233c]/5' : 'border-white/5 bg-white/[0.02]'
            ]"
          >
            <div class="text-xs text-zinc-500 mb-0.5">{{ day }}</div>
            <div v-for="session in getSessionsForDay(day).slice(0, 2)" :key="session.id" class="text-[0.6rem] text-[#ef233c] truncate">
              {{ session.title || `Session ${session.sessionNumber}` }}
            </div>
            <div v-if="getSessionsForDay(day).length > 2" class="text-[0.5rem] text-zinc-600">
              +{{ getSessionsForDay(day).length - 2 }} more
            </div>
          </div>
        </div>

        <!-- Sessions in Month List -->
        <div v-if="sessionsInMonth.length > 0" class="mt-6 pt-4 border-t border-white/[0.06]">
          <h3 class="text-zinc-300 font-medium mb-3" style="font-family: Manrope, sans-serif">Sessions in {{ monthNames[currentMonth] }}</h3>
          <div class="space-y-2">
            <RouterLink
              v-for="session in sessionsInMonth"
              :key="session.id"
              :to="`/sessions/${session.id}`"
              class="block p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-[#ef233c]/30 transition-colors"
            >
              <div class="flex items-center justify-between">
                <span class="text-zinc-200 font-medium">{{ session.title || `Session ${session.sessionNumber}` }}</span>
                <span class="text-xs text-zinc-600">
                  {{ session.inGameStartDate?.split('-')[2] }} {{ monthNames[currentMonth] }}
                  <span v-if="session.inGameDurationDays && session.inGameDurationDays > 1">
                    ({{ session.inGameDurationDays }} days)
                  </span>
                </span>
              </div>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- All Characters Downtime -->
    <div v-if="activeCharacters.length > 0" class="card p-5 relative z-10">
      <div class="relative z-10">
        <h3 class="text-zinc-200 font-semibold mb-4" style="font-family: Manrope, sans-serif">⏳ Character Downtime</h3>
        
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-zinc-500 border-b border-white/[0.06]">
                <th class="pb-2 font-medium">Character</th>
                <th class="pb-2 font-medium text-right">Earned</th>
                <th class="pb-2 font-medium text-right">Used</th>
                <th class="pb-2 font-medium text-right">Available</th>
                <th class="pb-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="char in activeCharacters" :key="char.id" class="border-b border-white/[0.03]">
                <td class="py-3">
                  <RouterLink :to="`/characters/${char.id}`" class="text-zinc-200 hover:text-[#ef233c] transition-colors">
                    {{ char.name }}
                  </RouterLink>
                </td>
                <td class="py-3 text-right text-zinc-400">{{ getDowntimeDays(char) }}</td>
                <td class="py-3 text-right">
                  <template v-if="editingDowntimeCharacterId === char.id">
                    <input
                      v-model.number="newDowntimeUsed"
                      type="number"
                      min="0"
                      :max="getDowntimeDays(char)"
                      class="input w-16 text-sm text-right"
                    />
                  </template>
                  <span v-else class="text-zinc-400">{{ char.downtimeDaysUsed || 0 }}</span>
                </td>
                <td class="py-3 text-right">
                  <span :class="getAvailableDowntime(char) > 0 ? 'text-[#ef233c] font-semibold' : 'text-zinc-500'">
                    {{ getAvailableDowntime(char) }}
                  </span>
                </td>
                <td class="py-3 text-right">
                  <template v-if="canEditDowntime(char)">
                    <template v-if="editingDowntimeCharacterId === char.id">
                      <button @click="saveDowntime(char)" :disabled="savingDowntime" class="btn !text-xs !px-2 !py-1 mr-1">
                        <span v-if="savingDowntime" class="inline-block w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span v-else>Save</span>
                      </button>
                      <button @click="cancelEditDowntime" class="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                    </template>
                    <button v-else @click="startEditDowntime(char)" class="text-xs text-zinc-500 hover:text-zinc-300">Edit</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

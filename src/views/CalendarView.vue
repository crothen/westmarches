<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, doc, query, orderBy, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { SessionLog, Character } from '../types'

interface CampaignConfig {
  startDate?: string  // YYYY-MM-DD
  startYear?: number
}

const auth = useAuthStore()
const sessions = ref<SessionLog[]>([])
const characters = ref<Character[]>([])
const config = ref<CampaignConfig>({})
const loading = ref(true)
const currentMonth = ref(new Date().getMonth())  // 0-11
const currentYear = ref(new Date().getFullYear())
const _unsubs: (() => void)[] = []

// Admin editing state
const editingConfig = ref(false)
const editStartDate = ref('')
const savingConfig = ref(false)

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

// Get sessions for a specific day
function getSessionsForDay(day: number): SessionLog[] {
  const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return sessions.value.filter(s => {
    if (!s.inGameStartDate) return false
    const startDate = new Date(s.inGameStartDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + (s.inGameDurationDays || 1) - 1)
    const checkDate = new Date(dateStr)
    return checkDate >= startDate && checkDate <= endDate
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
  // Find all sessions and calculate days the character was NOT present
  let totalDowntime = 0
  
  // Sort sessions by in-game date
  const sortedSessions = [...sessions.value]
    .filter(s => s.inGameStartDate)
    .sort((a, b) => a.inGameStartDate!.localeCompare(b.inGameStartDate!))
  
  for (const session of sortedSessions) {
    const wasPresent = session.participants?.some(p => p.characterId === character.id)
    
    if (!wasPresent) {
      // Add the session's duration to downtime
      totalDowntime += session.inGameDurationDays || 1
    }
  }
  
  return totalDowntime
}

function getAvailableDowntime(character: Character): number {
  return getDowntimeDays(character) - (character.downtimeDaysUsed || 0)
}

// Admin functions
function startEditConfig() {
  editStartDate.value = config.value.startDate || ''
  editingConfig.value = true
}

async function saveConfig() {
  savingConfig.value = true
  try {
    await setDoc(doc(db, 'config', 'campaign'), {
      startDate: editStartDate.value || null,
    }, { merge: true })
    editingConfig.value = false
  } catch (e) {
    console.error('Failed to save config:', e)
    alert('Failed to save: ' + (e as Error).message)
  } finally {
    savingConfig.value = false
  }
}

// My character's downtime
const myCharacter = computed(() => {
  if (!auth.firebaseUser) return null
  return characters.value.find(c => c.userId === auth.firebaseUser!.uid && c.isActive)
})

const editingDowntime = ref(false)
const newDowntimeUsed = ref(0)
const savingDowntime = ref(false)

function startEditDowntime() {
  newDowntimeUsed.value = myCharacter.value?.downtimeDaysUsed || 0
  editingDowntime.value = true
}

async function saveDowntime() {
  if (!myCharacter.value) return
  savingDowntime.value = true
  try {
    await updateDoc(doc(db, 'characters', myCharacter.value.id), {
      downtimeDaysUsed: newDowntimeUsed.value,
      updatedAt: new Date(),
    })
    editingDowntime.value = false
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
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📅 Campaign Calendar</h1>
      <button v-if="auth.isAdmin" @click="startEditConfig" class="btn text-sm">⚙️ Settings</button>
    </div>

    <!-- Admin Config -->
    <div v-if="editingConfig" class="card p-5 mb-6 relative z-10">
      <div class="relative z-10">
        <h3 class="text-zinc-200 font-semibold mb-3" style="font-family: Manrope, sans-serif">Campaign Settings</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="label block mb-1.5">Campaign Start Date</label>
            <input v-model="editStartDate" type="date" class="input w-full" />
            <p class="text-xs text-zinc-600 mt-1">The in-game date when the campaign begins</p>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button @click="saveConfig" :disabled="savingConfig" class="btn text-sm">
            {{ savingConfig ? 'Saving...' : 'Save' }}
          </button>
          <button @click="editingConfig = false" class="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
        </div>
      </div>
    </div>

    <!-- My Downtime Card -->
    <div v-if="myCharacter" class="card p-5 mb-6 relative z-10">
      <div class="relative z-10">
        <h3 class="text-zinc-200 font-semibold mb-2" style="font-family: Manrope, sans-serif">⏳ {{ myCharacter.name }}'s Downtime</h3>
        <div class="flex items-center gap-6">
          <div>
            <div class="text-3xl font-bold text-[#ef233c]">{{ getAvailableDowntime(myCharacter) }}</div>
            <div class="text-xs text-zinc-600 uppercase tracking-wider">Available Days</div>
          </div>
          <div class="text-zinc-600">
            <div class="text-sm">Total earned: {{ getDowntimeDays(myCharacter) }} days</div>
            <div class="text-sm">Used: {{ myCharacter.downtimeDaysUsed || 0 }} days</div>
          </div>
          <div class="flex-1" />
          <div v-if="!editingDowntime">
            <button @click="startEditDowntime" class="btn !text-xs">Update Used</button>
          </div>
          <div v-else class="flex items-center gap-2">
            <input v-model.number="newDowntimeUsed" type="number" min="0" :max="getDowntimeDays(myCharacter)" class="input w-20 text-sm" />
            <button @click="saveDowntime" :disabled="savingDowntime" class="btn !text-xs">Save</button>
            <button @click="editingDowntime = false" class="text-xs text-zinc-500">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading calendar...</div>

    <!-- Calendar -->
    <div v-else class="card p-5 relative z-10">
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
          <div v-for="_ in firstDayOfWeek" :key="'empty-' + _" class="aspect-square" />
          
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
  </div>
</template>

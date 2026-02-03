<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { ScheduledSession, Mission } from '../types'

interface LocationEntry { label: string }
type LocationsConfig = Record<string, LocationEntry>

const auth = useAuthStore()
const sessions = ref<ScheduledSession[]>([])
const missions = ref<Mission[]>([])
const sessionLocations = ref<LocationsConfig>({})
const loading = ref(true)
const showCreateForm = ref(false)
const newDate = ref('')
const newTitle = ref('')
const newDescription = ref('')
const newMaxPlayers = ref<number | undefined>(undefined)
const newLocationKey = ref('')
const editingSessionId = ref<string | null>(null)
const editDate = ref('')
const editTitle = ref('')
const editDescription = ref('')
const editMaxPlayers = ref<number | undefined>(undefined)
const editLocationKey = ref('')
const editStatus = ref<'upcoming' | 'in_progress' | 'completed' | 'cancelled'>('upcoming')
const editSaving = ref(false)
const deleteConfirmId = ref<string | null>(null)
const _unsubs: (() => void)[] = []

const sortedLocations = computed(() => {
  return Object.entries(sessionLocations.value)
    .map(([key, entry]) => ({ key, label: entry.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

onMounted(() => {
  _unsubs.push(onSnapshot(doc(db, 'config', 'sessionLocations'), (snap) => {
    if (snap.exists()) sessionLocations.value = snap.data() as LocationsConfig
  }, (e) => console.error('Failed to load session locations:', e)))

  _unsubs.push(onSnapshot(collection(db, 'missions'), (snap) => {
    missions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
  }, (e) => console.error('Failed to load missions:', e)))

  const q = query(collection(db, 'scheduledSessions'), orderBy('date', 'asc'))
  _unsubs.push(onSnapshot(q, (snap) => {
    sessions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduledSession))
    loading.value = false
  }, (e) => {
    console.error('Failed to load scheduled sessions:', e)
    loading.value = false
  }))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const upcomingSessions = computed(() => sessions.value.filter(s => s.status === 'upcoming' || s.status === 'in_progress'))
const availableMissions = computed(() => missions.value.filter(m => m.status === 'available'))

const missionsByUnit = computed(() => {
  const groups: Record<string, Mission[]> = {}
  for (const m of availableMissions.value) {
    if (!groups[m.unitName]) groups[m.unitName] = []
    groups[m.unitName]!.push(m)
  }
  return groups
})

function isSignedUp(session: ScheduledSession): boolean {
  return session.signups?.some(s => s.userId === auth.firebaseUser?.uid) || false
}

function getMyVote(session: ScheduledSession): string | null {
  const vote = session.missionVotes?.find(v => v.userId === auth.firebaseUser?.uid)
  return vote?.missionId || null
}

function getMissionTitle(missionId: string): string {
  const m = missions.value.find(m => m.id === missionId)
  return m ? `[T${m.tier}] ${m.description.substring(0, 80)}${m.description.length > 80 ? '...' : ''}` : missionId
}

function getMissionUnit(missionId: string): string {
  const m = missions.value.find(m => m.id === missionId)
  return m?.unitName || ''
}

function getVoteCounts(session: ScheduledSession): Array<{ missionId: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const v of session.missionVotes || []) {
    counts[v.missionId] = (counts[v.missionId] || 0) + 1
  }
  return Object.entries(counts)
    .map(([missionId, count]) => ({ missionId, count }))
    .sort((a, b) => b.count - a.count)
}

/** Get missions liked by signed-up participants, ranked by count */
function getParticipantLikedMissions(session: ScheduledSession): Array<{ mission: Mission; count: number; voters: string[] }> {
  const signedUpUserIds = new Set((session.signups || []).map(s => s.userId))
  if (signedUpUserIds.size === 0) return []

  const results: Array<{ mission: Mission; count: number; voters: string[] }> = []
  for (const m of availableMissions.value) {
    const matchingVoters = (m.votes || []).filter(v => signedUpUserIds.has(v.userId))
    if (matchingVoters.length > 0) {
      results.push({
        mission: m,
        count: matchingVoters.length,
        voters: matchingVoters.map(v => v.userName),
      })
    }
  }
  return results.sort((a, b) => b.count - a.count)
}

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

async function createSession() {
  if (!newDate.value) return
  const loc = sessionLocations.value[newLocationKey.value]
  await addDoc(collection(db, 'scheduledSessions'), {
    date: Timestamp.fromDate(new Date(newDate.value)),
    title: newTitle.value || null,
    description: newDescription.value || null,
    maxPlayers: newMaxPlayers.value || null,
    sessionLocationKey: newLocationKey.value || null,
    sessionLocationLabel: loc?.label || null,
    signups: [],
    missionVotes: [],
    status: 'upcoming',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
  newDate.value = ''
  newTitle.value = ''
  newDescription.value = ''
  newMaxPlayers.value = undefined
  newLocationKey.value = ''
  showCreateForm.value = false
}

async function toggleSignup(session: ScheduledSession) {
  if (!auth.firebaseUser) return
  const sessionRef = doc(db, 'scheduledSessions', session.id)
  const currentSignups = session.signups || []
  const currentVotes = session.missionVotes || []

  if (isSignedUp(session)) {
    await updateDoc(sessionRef, {
      signups: currentSignups.filter(s => s.userId !== auth.firebaseUser!.uid),
      missionVotes: currentVotes.filter(v => v.userId !== auth.firebaseUser!.uid),
      updatedAt: Timestamp.now()
    })
  } else {
    if (session.maxPlayers && currentSignups.length >= session.maxPlayers) {
      alert('Session is full!')
      return
    }
    await updateDoc(sessionRef, {
      signups: [...currentSignups, {
        userId: auth.firebaseUser.uid,
        characterName: auth.appUser?.displayName || 'Unknown',
        signedUpAt: Timestamp.now()
      }],
      updatedAt: Timestamp.now()
    })
  }
}

async function voteMission(session: ScheduledSession, missionId: string) {
  if (!auth.firebaseUser || !isSignedUp(session)) return
  const sessionRef = doc(db, 'scheduledSessions', session.id)
  const currentVotes = session.missionVotes || []
  const otherVotes = currentVotes.filter(v => v.userId !== auth.firebaseUser!.uid)

  await updateDoc(sessionRef, {
    missionVotes: [...otherVotes, {
      userId: auth.firebaseUser.uid,
      missionId,
      votedAt: Timestamp.now()
    }],
    updatedAt: Timestamp.now()
  })
}

async function removeVote(session: ScheduledSession) {
  if (!auth.firebaseUser) return
  const sessionRef = doc(db, 'scheduledSessions', session.id)
  await updateDoc(sessionRef, {
    missionVotes: (session.missionVotes || []).filter(v => v.userId !== auth.firebaseUser!.uid),
    updatedAt: Timestamp.now()
  })
}

function startEditing(session: ScheduledSession) {
  editingSessionId.value = session.id
  const d = (session.date as any).toDate ? (session.date as any).toDate() : new Date(session.date)
  const pad = (n: number) => String(n).padStart(2, '0')
  editDate.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  editTitle.value = session.title || ''
  editDescription.value = session.description || ''
  editMaxPlayers.value = session.maxPlayers || undefined
  editLocationKey.value = session.sessionLocationKey || ''
  editStatus.value = session.status
}

function cancelEditing() {
  editingSessionId.value = null
  deleteConfirmId.value = null
}

async function saveEdit(session: ScheduledSession) {
  if (!editDate.value) return
  editSaving.value = true
  try {
    const loc = sessionLocations.value[editLocationKey.value]
    const sessionRef = doc(db, 'scheduledSessions', session.id)
    await updateDoc(sessionRef, {
      date: Timestamp.fromDate(new Date(editDate.value)),
      title: editTitle.value || null,
      description: editDescription.value || null,
      maxPlayers: editMaxPlayers.value || null,
      sessionLocationKey: editLocationKey.value || null,
      sessionLocationLabel: loc?.label || null,
      status: editStatus.value,
      updatedAt: Timestamp.now()
    })
    editingSessionId.value = null
  } finally {
    editSaving.value = false
  }
}

async function deleteSession(session: ScheduledSession) {
  await deleteDoc(doc(db, 'scheduledSessions', session.id))
  deleteConfirmId.value = null
  editingSessionId.value = null
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📅 Session Schedule</h1>
      <button v-if="auth.isDm || auth.isAdmin" @click="showCreateForm = !showCreateForm" class="btn text-sm">
        {{ showCreateForm ? 'Cancel' : '+ Schedule Session' }}
      </button>
    </div>

    <!-- Create Form (DM only) -->
    <div v-if="showCreateForm" class="card p-5 mb-6 relative z-10">
      <div class="relative z-10">
        <h3 class="text-zinc-200 font-semibold mb-3" style="font-family: Manrope, sans-serif">Schedule New Session</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="label block mb-1.5">Date *</label>
            <input v-model="newDate" type="datetime-local" class="input w-full" />
          </div>
          <div>
            <label class="label block mb-1.5">Title (optional)</label>
            <input v-model="newTitle" type="text" placeholder="e.g. Session 2" class="input w-full" />
          </div>
          <div class="md:col-span-2">
            <label class="label block mb-1.5">Description (optional)</label>
            <textarea v-model="newDescription" rows="2" class="input w-full" />
          </div>
          <div>
            <label class="label block mb-1.5">Max Players (optional)</label>
            <input v-model.number="newMaxPlayers" type="number" min="1" class="input w-full" />
          </div>
          <div>
            <label class="label block mb-1.5">Location (optional)</label>
            <select v-model="newLocationKey" class="input w-full">
              <option value="">— None —</option>
              <option v-for="loc in sortedLocations" :key="loc.key" :value="loc.key">{{ loc.label }}</option>
            </select>
          </div>
        </div>
        <button @click="createSession" :disabled="!newDate" class="btn text-sm mt-3">Create</button>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading schedule...</div>

    <!-- Upcoming Sessions -->
    <div v-if="upcomingSessions.length > 0" class="space-y-4 mb-8">
      <div v-for="session in upcomingSessions" :key="session.id" class="card p-5 relative z-10">
        <div class="relative z-10">
          <!-- Edit Form (Admin/DM) -->
          <div v-if="editingSessionId === session.id" class="space-y-3">
            <h3 class="text-zinc-200 font-semibold" style="font-family: Manrope, sans-serif">Edit Session</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="label block mb-1.5">Date *</label>
                <input v-model="editDate" type="datetime-local" class="input w-full" />
              </div>
              <div>
                <label class="label block mb-1.5">Title</label>
                <input v-model="editTitle" type="text" placeholder="e.g. Session 2" class="input w-full" />
              </div>
              <div class="md:col-span-2">
                <label class="label block mb-1.5">Description</label>
                <textarea v-model="editDescription" rows="2" class="input w-full" />
              </div>
              <div>
                <label class="label block mb-1.5">Max Players</label>
                <input v-model.number="editMaxPlayers" type="number" min="1" class="input w-full" />
              </div>
              <div>
                <label class="label block mb-1.5">Status</label>
                <select v-model="editStatus" class="input w-full">
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label class="label block mb-1.5">Location</label>
                <select v-model="editLocationKey" class="input w-full">
                  <option value="">— None —</option>
                  <option v-for="loc in sortedLocations" :key="loc.key" :value="loc.key">{{ loc.label }}</option>
                </select>
              </div>
            </div>
            <div class="flex items-center gap-2 pt-1">
              <button @click="saveEdit(session)" :disabled="!editDate || editSaving" class="btn text-sm">
                {{ editSaving ? 'Saving...' : 'Save' }}
              </button>
              <button @click="cancelEditing" class="text-sm text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5">Cancel</button>
              <div class="flex-1" />
              <button v-if="deleteConfirmId !== session.id" @click="deleteConfirmId = session.id" class="text-sm text-red-500/60 hover:text-red-400 transition-colors px-3 py-1.5">
                Delete
              </button>
              <div v-else class="flex items-center gap-2">
                <span class="text-xs text-red-400">Are you sure?</span>
                <button @click="deleteSession(session)" class="text-sm text-red-400 font-medium hover:text-red-300 transition-colors px-2 py-1">Yes, delete</button>
                <button @click="deleteConfirmId = null" class="text-sm text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1">No</button>
              </div>
            </div>
          </div>

          <!-- Normal Display -->
          <div v-else>
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-3">
                <span class="text-xl font-bold text-zinc-100" style="font-family: Manrope, sans-serif">{{ session.title || 'Game Session' }}</span>
                <span class="text-xs px-2 py-0.5 rounded-md bg-green-500/15 text-green-400">{{ session.status }}</span>
                <button v-if="auth.isDm || auth.isAdmin" @click="startEditing(session)" class="text-zinc-600 hover:text-zinc-300 transition-colors" title="Edit session">
                  ✏️
                </button>
              </div>
              <p class="text-[#ef233c] font-medium mt-1">📅 {{ formatDate(session.date) }}<span v-if="session.sessionLocationLabel" class="text-zinc-500 ml-2">📍 {{ session.sessionLocationLabel }}</span></p>
              <p v-if="session.description" class="text-zinc-500 text-sm mt-1">{{ session.description }}</p>
            </div>
            <button @click="toggleSignup(session)" :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              isSignedUp(session) ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
            ]">
              {{ isSignedUp(session) ? '✖ Withdraw' : '✋ Sign Up' }}
            </button>
          </div>

          <!-- Signups -->
          <div class="mb-4">
            <h4 class="text-zinc-500 text-sm mb-2">
              Signed up: {{ session.signups?.length || 0 }}{{ session.maxPlayers ? ` / ${session.maxPlayers}` : '' }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="s in session.signups" :key="s.userId" class="bg-white/[0.05] text-zinc-200 text-sm px-2.5 py-1 rounded-lg border border-white/[0.06]">
                {{ s.characterName }}
              </span>
              <span v-if="!session.signups?.length" class="text-zinc-600 text-sm">No signups yet</span>
            </div>
          </div>

          <!-- Missions liked by participants (compact table) -->
          <div v-if="getParticipantLikedMissions(session).length > 0" class="border-t border-white/[0.06] pt-4">
            <h4 class="text-zinc-300 font-medium mb-2" style="font-family: Manrope, sans-serif">⚔️ Missions Liked by Participants</h4>
            <div class="grid gap-y-1 text-sm" style="grid-template-columns: 2rem 2.5rem 1fr auto auto">
              <template v-for="item in getParticipantLikedMissions(session)" :key="item.mission.id">
                <span class="text-[#ef233c] font-bold text-center">{{ item.count }}</span>
                <span :class="['tier', item.mission.tier === 2 ? 'tier-2' : item.mission.tier === 3 ? 'tier-3' : item.mission.tier === 4 ? 'tier-4' : 'tier-5']">T{{ item.mission.tier }}</span>
                <span class="text-zinc-200 truncate px-1">{{ item.mission.title }}</span>
                <span class="text-zinc-600 text-xs px-2 self-center">{{ item.mission.unitName }}</span>
                <span v-if="item.mission.suggested" class="text-xs self-center">⭐</span>
                <span v-else />
              </template>
            </div>
          </div>
          <div v-else-if="(session.signups || []).length > 0" class="border-t border-white/[0.06] pt-4">
            <p class="text-zinc-600 text-sm">No participants have liked any missions yet. Vote on the <RouterLink to="/missions" class="text-[#ef233c] hover:underline">Missions Board</RouterLink>!</p>
          </div>
          </div><!-- /v-else normal display -->
        </div>
      </div>
    </div>

    <div v-if="!loading && upcomingSessions.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📅</div>
      <p class="text-zinc-500">No sessions scheduled yet.</p>
      <p v-if="auth.isDm || auth.isAdmin" class="text-zinc-600 text-sm mt-1">Use the button above to schedule one!</p>
    </div>
  </div>
</template>

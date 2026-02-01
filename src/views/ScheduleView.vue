<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { ScheduledSession, Mission } from '../types'

const auth = useAuthStore()
const sessions = ref<ScheduledSession[]>([])
const missions = ref<Mission[]>([])
const loading = ref(true)
const showCreateForm = ref(false)
const newDate = ref('')
const newTitle = ref('')
const newDescription = ref('')
const newMaxPlayers = ref<number | undefined>(undefined)
let unsubSessions: (() => void) | null = null

onMounted(async () => {
  // Load missions for voting
  try {
    const mSnap = await getDocs(collection(db, 'missions'))
    missions.value = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
  } catch (e) {
    console.error('Failed to load missions:', e)
  }

  // Real-time sessions
  const q = query(collection(db, 'scheduledSessions'), orderBy('date', 'asc'))
  unsubSessions = onSnapshot(q, (snap) => {
    sessions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduledSession))
    loading.value = false
  })
})

onUnmounted(() => {
  unsubSessions?.()
})

const upcomingSessions = computed(() => sessions.value.filter(s => s.status === 'upcoming' || s.status === 'in_progress'))
const availableMissions = computed(() => missions.value.filter(m => m.status === 'available'))

// Group available missions by unit for the voting dropdown
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

function formatDate(date: any): string {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

async function createSession() {
  if (!newDate.value) return
  await addDoc(collection(db, 'scheduledSessions'), {
    date: Timestamp.fromDate(new Date(newDate.value)),
    title: newTitle.value || null,
    description: newDescription.value || null,
    maxPlayers: newMaxPlayers.value || null,
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
  showCreateForm.value = false
}

async function toggleSignup(session: ScheduledSession) {
  if (!auth.firebaseUser) return
  const sessionRef = doc(db, 'scheduledSessions', session.id)
  const currentSignups = session.signups || []
  const currentVotes = session.missionVotes || []

  if (isSignedUp(session)) {
    // Remove signup and any vote
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
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-amber-500">📅 Session Schedule</h1>
      <button v-if="auth.isDm" @click="showCreateForm = !showCreateForm" class="bg-amber-600 hover:bg-amber-500 text-stone-900 text-sm font-medium px-4 py-2 rounded transition-colors">
        {{ showCreateForm ? 'Cancel' : '+ Schedule Session' }}
      </button>
    </div>

    <!-- Create Form (DM only) -->
    <div v-if="showCreateForm" class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-6">
      <h3 class="text-stone-200 font-semibold mb-3">Schedule New Session</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-stone-400 text-sm mb-1">Date *</label>
          <input v-model="newDate" type="datetime-local" class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Title (optional)</label>
          <input v-model="newTitle" type="text" placeholder="e.g. Session 2" class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-stone-400 text-sm mb-1">Description (optional)</label>
          <textarea v-model="newDescription" rows="2" class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Max Players (optional)</label>
          <input v-model.number="newMaxPlayers" type="number" min="1" class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none" />
        </div>
      </div>
      <button @click="createSession" :disabled="!newDate" class="mt-3 bg-amber-600 hover:bg-amber-500 text-stone-900 text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-50">Create</button>
    </div>

    <div v-if="loading" class="text-stone-400 animate-pulse">Loading schedule...</div>

    <!-- Upcoming Sessions -->
    <div v-if="upcomingSessions.length > 0" class="space-y-4 mb-8">
      <div v-for="session in upcomingSessions" :key="session.id" class="bg-stone-800 border border-stone-700 rounded-lg p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center gap-3">
              <span class="text-xl font-bold text-stone-100">{{ session.title || 'Game Session' }}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-700">{{ session.status }}</span>
            </div>
            <p class="text-amber-500 font-medium mt-1">📅 {{ formatDate(session.date) }}</p>
            <p v-if="session.description" class="text-stone-400 text-sm mt-1">{{ session.description }}</p>
          </div>
          <button @click="toggleSignup(session)" :class="[
            'px-4 py-2 rounded text-sm font-medium transition-colors',
            isSignedUp(session) ? 'bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-900' : 'bg-green-900/50 text-green-400 border border-green-700 hover:bg-green-900'
          ]">
            {{ isSignedUp(session) ? '✖ Withdraw' : '✋ Sign Up' }}
          </button>
        </div>

        <!-- Signups -->
        <div class="mb-4">
          <h4 class="text-stone-400 text-sm mb-2">
            Signed up: {{ session.signups?.length || 0 }}{{ session.maxPlayers ? ` / ${session.maxPlayers}` : '' }}
          </h4>
          <div class="flex flex-wrap gap-2">
            <span v-for="s in session.signups" :key="s.userId" class="bg-stone-700 text-stone-200 text-sm px-2 py-1 rounded">
              {{ s.characterName }}
            </span>
            <span v-if="!session.signups?.length" class="text-stone-500 text-sm">No signups yet</span>
          </div>
        </div>

        <!-- Mission Voting (only if signed up) -->
        <div v-if="isSignedUp(session)" class="border-t border-stone-700 pt-4">
          <h4 class="text-stone-300 font-medium mb-2">🗳️ Vote for a Mission</h4>

          <div class="mb-3">
            <select @change="(e: any) => { if (e.target.value) voteMission(session, e.target.value); e.target.value = '' }" class="bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-200 text-sm focus:border-amber-500 focus:outline-none w-full max-w-lg">
              <option value="">Select a mission to vote for...</option>
              <optgroup v-for="(unitMissions, unitName) in missionsByUnit" :key="unitName" :label="unitName">
                <option v-for="m in unitMissions" :key="m.id" :value="m.id">
                  [T{{ m.tier }}] {{ m.description.substring(0, 100) }}
                </option>
              </optgroup>
            </select>
          </div>

          <div v-if="getMyVote(session)" class="text-sm text-stone-400 mb-2">
            Your vote: <span class="text-amber-500">{{ getMissionTitle(getMyVote(session)!) }}</span>
            <button @click="removeVote(session)" class="text-red-400 hover:text-red-300 ml-2">(remove)</button>
          </div>
        </div>

        <!-- Vote Results (visible to all) -->
        <div v-if="getVoteCounts(session).length > 0" class="mt-3">
          <h4 class="text-stone-400 text-sm mb-2">Current Votes:</h4>
          <div class="space-y-1">
            <div v-for="vc in getVoteCounts(session)" :key="vc.missionId" class="flex items-center gap-2 text-sm">
              <span class="text-amber-500 font-bold w-6 text-right">{{ vc.count }}</span>
              <span class="text-stone-500">|</span>
              <span class="text-stone-300">{{ getMissionTitle(vc.missionId) }}</span>
              <span class="text-stone-600 text-xs">({{ getMissionUnit(vc.missionId) }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && upcomingSessions.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📅</div>
      <p class="text-stone-400">No sessions scheduled yet.</p>
      <p v-if="auth.isDm" class="text-stone-500 text-sm mt-1">Use the button above to schedule one!</p>
    </div>
  </div>
</template>

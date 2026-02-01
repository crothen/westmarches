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
  try {
    const mSnap = await getDocs(collection(db, 'missions'))
    missions.value = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
  } catch (e) {
    console.error('Failed to load missions:', e)
  }

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
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📅 Session Schedule</h1>
      <button v-if="auth.isDm" @click="showCreateForm = !showCreateForm" class="btn text-sm">
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
        </div>
        <button @click="createSession" :disabled="!newDate" class="btn text-sm mt-3">Create</button>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading schedule...</div>

    <!-- Upcoming Sessions -->
    <div v-if="upcomingSessions.length > 0" class="space-y-4 mb-8">
      <div v-for="session in upcomingSessions" :key="session.id" class="card p-5 relative z-10">
        <div class="relative z-10">
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-3">
                <span class="text-xl font-bold text-zinc-100" style="font-family: Manrope, sans-serif">{{ session.title || 'Game Session' }}</span>
                <span class="text-xs px-2 py-0.5 rounded-md bg-green-500/15 text-green-400">{{ session.status }}</span>
              </div>
              <p class="text-[#ef233c] font-medium mt-1">📅 {{ formatDate(session.date) }}</p>
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

          <!-- Mission Voting (only if signed up) -->
          <div v-if="isSignedUp(session)" class="border-t border-white/[0.06] pt-4">
            <h4 class="text-zinc-300 font-medium mb-2" style="font-family: Manrope, sans-serif">🗳️ Vote for a Mission</h4>

            <div class="mb-3">
              <select @change="(e: any) => { if (e.target.value) voteMission(session, e.target.value); e.target.value = '' }" class="input w-full max-w-lg text-sm">
                <option value="">Select a mission to vote for...</option>
                <optgroup v-for="(unitMissions, unitName) in missionsByUnit" :key="unitName" :label="unitName">
                  <option v-for="m in unitMissions" :key="m.id" :value="m.id">
                    [T{{ m.tier }}] {{ m.description.substring(0, 100) }}
                  </option>
                </optgroup>
              </select>
            </div>

            <div v-if="getMyVote(session)" class="text-sm text-zinc-500 mb-2">
              Your vote: <span class="text-[#ef233c]">{{ getMissionTitle(getMyVote(session)!) }}</span>
              <button @click="removeVote(session)" class="text-red-400 hover:text-red-300 ml-2 transition-colors">(remove)</button>
            </div>
          </div>

          <!-- Vote Results (visible to all) -->
          <div v-if="getVoteCounts(session).length > 0" class="mt-3">
            <h4 class="text-zinc-500 text-sm mb-2">Current Votes:</h4>
            <div class="space-y-1">
              <div v-for="vc in getVoteCounts(session)" :key="vc.missionId" class="flex items-center gap-2 text-sm">
                <span class="text-[#ef233c] font-bold w-6 text-right">{{ vc.count }}</span>
                <span class="text-zinc-700">|</span>
                <span class="text-zinc-300">{{ getMissionTitle(vc.missionId) }}</span>
                <span class="text-zinc-700 text-xs">({{ getMissionUnit(vc.missionId) }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && upcomingSessions.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📅</div>
      <p class="text-zinc-500">No sessions scheduled yet.</p>
      <p v-if="auth.isDm" class="text-zinc-600 text-sm mt-1">Use the button above to schedule one!</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { Mission } from '../types'

const auth = useAuthStore()
const missions = ref<Mission[]>([])
const loading = ref(true)
const filterTier = ref<number | null>(null)
const filterUnit = ref<string | null>(null)
const sortBy = ref<'unit' | 'votes'>('unit')

let _unsub: (() => void) | null = null

onMounted(() => {
  _unsub = onSnapshot(query(collection(db, 'missions'), orderBy('tier', 'asc')), (snap) => {
    missions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
    loading.value = false
  }, (e) => {
    console.error('Failed to load missions:', e)
    loading.value = false
  })
})

onUnmounted(() => _unsub?.())

const units = computed(() => {
  const set = new Set(missions.value.map(m => m.unitName))
  return Array.from(set).sort()
})

const filteredMissions = computed(() => {
  return missions.value.filter(m => {
    if (filterTier.value && m.tier !== filterTier.value) return false
    if (filterUnit.value && m.unitName !== filterUnit.value) return false
    return true
  })
})

const groupedMissions = computed(() => {
  const groups: Record<string, Mission[]> = {}
  for (const m of filteredMissions.value) {
    if (!groups[m.unitName]) groups[m.unitName] = []
    groups[m.unitName]!.push(m)
  }
  return groups
})

const sortedByVotes = computed(() => {
  return [...filteredMissions.value].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0))
})

function getVoteCount(mission: Mission): number {
  return mission.votes?.length || 0
}

function hasVoted(mission: Mission): boolean {
  if (!auth.firebaseUser) return false
  return (mission.votes || []).some(v => v.userId === auth.firebaseUser!.uid)
}

function getVoterNames(mission: Mission): string {
  return (mission.votes || []).map(v => v.userName).join(', ')
}

async function toggleVote(mission: Mission) {
  if (!auth.firebaseUser || !auth.isAuthenticated) return
  const votes = mission.votes || []
  const already = votes.some(v => v.userId === auth.firebaseUser!.uid)
  let newVotes
  if (already) {
    newVotes = votes.filter(v => v.userId !== auth.firebaseUser!.uid)
  } else {
    newVotes = [...votes, { userId: auth.firebaseUser!.uid, userName: auth.appUser?.displayName || 'Unknown' }]
  }
  try {
    await updateDoc(doc(db, 'missions', mission.id), { votes: newVotes })
    mission.votes = newVotes
  } catch (e) {
    console.error('Failed to vote:', e)
  }
}

const tierBadgeClass: Record<number, string> = {
  2: 'tier tier-2',
  3: 'tier tier-3',
  4: 'tier tier-4',
  5: 'tier tier-5',
}

function formatPay(pay: Mission['pay']): string {
  if (pay.note) return pay.note
  if (pay.type === 'performance') return 'Performance-based'
  if (pay.type === 'per_day') return `${pay.amount} ${pay.currency}/day each`
  return `${pay.amount} ${pay.currency} ${pay.type}`
}

function formatDuration(m: Mission): string {
  if (m.durationNote) return m.durationNote
  const parts: string[] = []
  if (m.expectedDurationDays) parts.push(`${m.expectedDurationDays} days total`)
  if (m.missionDurationDays) parts.push(`${m.missionDurationDays} in mission`)
  return parts.join(', ') || 'Unknown'
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-white mb-6" style="font-family: Manrope, sans-serif">⚔️ Missions Board</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6 items-center">
      <select v-model="filterUnit" class="input text-sm">
        <option :value="null">All Units</option>
        <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
      </select>
      <div class="flex gap-1">
        <button @click="filterTier = null" :class="['px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-150', !filterTier ? 'bg-[#ef233c] text-white' : 'bg-white/[0.05] text-zinc-500 border border-white/10 hover:text-zinc-200']" style="font-family: Manrope, sans-serif">All</button>
        <button v-for="t in [2,3,4,5]" :key="t" @click="filterTier = filterTier === t ? null : t" :class="['px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-150', filterTier === t ? 'bg-[#ef233c] text-white' : 'bg-white/[0.05] text-zinc-500 border border-white/10 hover:text-zinc-200']" style="font-family: Manrope, sans-serif">T{{ t }}</button>
      </div>
      <div class="flex gap-1 ml-auto">
        <button @click="sortBy = 'unit'" :class="['px-3 py-1.5 rounded-full text-xs transition-all duration-150', sortBy === 'unit' ? 'bg-white/10 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400']">By Unit</button>
        <button @click="sortBy = 'votes'" :class="['px-3 py-1.5 rounded-full text-xs transition-all duration-150', sortBy === 'votes' ? 'bg-white/10 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400']">By Votes 👍</button>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading missions...</div>

    <div v-else-if="filteredMissions.length === 0" class="text-center py-12">
      <p class="text-zinc-500">No missions found.</p>
    </div>

    <!-- Grouped by unit -->
    <div v-else-if="sortBy === 'unit'" class="space-y-8">
      <div v-for="(unitMissions, unitName) in groupedMissions" :key="unitName">
        <h2 class="text-xl font-bold text-zinc-200 mb-3 flex items-center gap-2" style="font-family: Manrope, sans-serif">
          🛡️ {{ unitName }}
          <span class="text-zinc-600 text-sm font-normal">({{ unitMissions.length }} missions)</span>
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div v-for="mission in unitMissions" :key="mission.id" class="card p-4 relative z-10 flex flex-col">
            <div class="relative z-10 flex items-start gap-3 flex-1">
              <!-- Vote button (left) -->
              <div v-if="auth.isAuthenticated" class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
                <button
                  @click="toggleVote(mission)"
                  :class="['w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all', hasVoted(mission) ? 'bg-[#ef233c] text-white shadow-lg shadow-[#ef233c]/25' : 'bg-white/5 text-zinc-600 hover:bg-white/10 hover:text-zinc-300']"
                >👍</button>
                <span :class="['text-sm font-bold', getVoteCount(mission) > 0 ? 'text-[#ef233c]' : 'text-zinc-700']">{{ getVoteCount(mission) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <span :class="tierBadgeClass[mission.tier] || 'tier'">T{{ mission.tier }}</span>
                  <span v-if="mission.status !== 'available'" :class="['text-xs px-2 py-0.5 rounded-md', mission.status === 'completed' ? 'bg-green-500/15 text-green-400' : mission.status === 'in_progress' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-red-500/15 text-red-400']">{{ mission.status.replace('_', ' ') }}</span>
                </div>
                <p class="text-zinc-200">{{ mission.description }}</p>
                <div class="flex flex-wrap gap-4 mt-2 text-sm text-zinc-500">
                  <span>⏱️ {{ formatDuration(mission) }}</span>
                  <span>💰 {{ formatPay(mission.pay) }}</span>
                </div>
                <div v-if="getVoteCount(mission) > 0" class="mt-3 pt-2.5 border-t border-white/5">
                  <span class="text-xs text-zinc-400">👍 Interested: <span class="text-zinc-300">{{ getVoterNames(mission) }}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sorted by votes -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <div v-for="mission in sortedByVotes" :key="mission.id" class="card p-4 relative z-10 flex flex-col">
        <div class="relative z-10 flex items-start gap-3 flex-1">
          <!-- Vote button (left) -->
          <div v-if="auth.isAuthenticated" class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
            <button
              @click="toggleVote(mission)"
              :class="['w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all', hasVoted(mission) ? 'bg-[#ef233c] text-white shadow-lg shadow-[#ef233c]/25' : 'bg-white/5 text-zinc-600 hover:bg-white/10 hover:text-zinc-300']"
            >👍</button>
            <span :class="['text-sm font-bold', getVoteCount(mission) > 0 ? 'text-[#ef233c]' : 'text-zinc-700']">{{ getVoteCount(mission) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span :class="tierBadgeClass[mission.tier] || 'tier'">T{{ mission.tier }}</span>
              <span class="text-xs text-zinc-600">{{ mission.unitName }}</span>
              <span v-if="mission.status !== 'available'" :class="['text-xs px-2 py-0.5 rounded-md', mission.status === 'completed' ? 'bg-green-500/15 text-green-400' : mission.status === 'in_progress' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-red-500/15 text-red-400']">{{ mission.status.replace('_', ' ') }}</span>
            </div>
            <p class="text-zinc-200">{{ mission.description }}</p>
            <div class="flex flex-wrap gap-4 mt-2 text-sm text-zinc-500">
              <span>⏱️ {{ formatDuration(mission) }}</span>
              <span>💰 {{ formatPay(mission.pay) }}</span>
            </div>
            <div v-if="getVoteCount(mission) > 0" class="mt-3 pt-2.5 border-t border-white/5">
              <span class="text-xs text-zinc-400">👍 Interested: <span class="text-zinc-300">{{ getVoterNames(mission) }}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { Mission, MissionStatus, Organization } from '../types'

const auth = useAuthStore()
const missions = ref<Mission[]>([])
const organizations = ref<Organization[]>([])
const loading = ref(true)
const filterTier = ref<number | null>(null)
const filterUnit = ref<string | null>(null)
const filterSuggested = ref(false)
const sortBy = ref<'unit' | 'votes'>('unit')

// CRUD state
const showModal = ref(false)
const editingMission = ref<string | null>(null)
const saving = ref(false)
const deletingId = ref<string | null>(null)

const defaultForm = () => ({
  unitId: '',
  title: '',
  description: '',
  tier: 2,
  expectedDurationDays: undefined as number | undefined,
  missionDurationDays: undefined as number | undefined,
  durationNote: '',
  payAmount: 0,
  payType: 'each' as 'each' | 'total' | 'per_day' | 'performance',
  payCurrency: 'gold' as 'silver' | 'gold',
  payNote: '',
  status: 'available' as MissionStatus,
})

const form = ref(defaultForm())

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(query(collection(db, 'missions'), orderBy('tier', 'asc')), (snap) => {
    missions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
    loading.value = false
  }, (e) => {
    console.error('Failed to load missions:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    organizations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))
  }, (e) => console.error('Failed to load organizations:', e)))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const canManage = computed(() => auth.isDm || auth.isAdmin)

const units = computed(() => {
  const set = new Set(missions.value.map(m => m.unitName))
  return Array.from(set).sort()
})

const filteredMissions = computed(() => {
  return missions.value.filter(m => {
    if (filterTier.value && m.tier !== filterTier.value) return false
    if (filterUnit.value && m.unitName !== filterUnit.value) return false
    if (filterSuggested.value && !m.suggested) return false
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
  if (!auth.firebaseUser || !auth.isAuthenticated || auth.isGuest) return
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

// --- Group accent colors (cycle through a palette) ---
const groupAccentColors = ['#ef233c', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function getGroupAccent(index: number): string {
  return groupAccentColors[index % groupAccentColors.length]!
}

// --- CRUD ---
function openCreate() {
  editingMission.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEdit(mission: Mission) {
  editingMission.value = mission.id
  form.value = {
    unitId: mission.unitId || '',
    title: mission.title || '',
    description: mission.description || '',
    tier: mission.tier || 2,
    expectedDurationDays: mission.expectedDurationDays,
    missionDurationDays: mission.missionDurationDays,
    durationNote: mission.durationNote || '',
    payAmount: mission.pay?.amount || 0,
    payType: mission.pay?.type || 'each',
    payCurrency: mission.pay?.currency || 'gold',
    payNote: mission.pay?.note || '',
    status: mission.status || 'available',
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingMission.value = null
}

const selectedOrg = computed(() => {
  return organizations.value.find(o => o.id === form.value.unitId)
})

async function saveMission() {
  if (!form.value.unitId || !(form.value.title || '').trim() || !(form.value.description || '').trim()) return
  const org = selectedOrg.value
  if (!org) return

  saving.value = true
  try {
    const data: Record<string, unknown> = {
      unitId: form.value.unitId,
      unitName: org.name,
      title: (form.value.title || '').trim(),
      description: (form.value.description || '').trim(),
      tier: form.value.tier,
      pay: {
        amount: form.value.payAmount,
        type: form.value.payType,
        currency: form.value.payCurrency,
        ...((form.value.payNote || '').trim() ? { note: (form.value.payNote || '').trim() } : {}),
      },
      status: form.value.status,
      updatedAt: new Date(),
    }

    if (form.value.expectedDurationDays) data.expectedDurationDays = form.value.expectedDurationDays
    else data.expectedDurationDays = null
    if (form.value.missionDurationDays) data.missionDurationDays = form.value.missionDurationDays
    else data.missionDurationDays = null
    if ((form.value.durationNote || '').trim()) data.durationNote = (form.value.durationNote || '').trim()
    else data.durationNote = null

    if (editingMission.value) {
      await updateDoc(doc(db, 'missions', editingMission.value), data)
    } else {
      data.createdAt = new Date()
      data.votes = []
      await addDoc(collection(db, 'missions'), data)
    }

    closeModal()
  } catch (e) {
    console.error('Failed to save mission:', e)
    alert('Failed to save. Check permissions.')
  } finally {
    saving.value = false
  }
}

async function toggleSuggested(mission: Mission) {
  try {
    const newVal = !mission.suggested
    await updateDoc(doc(db, 'missions', mission.id), { suggested: newVal })
    mission.suggested = newVal
  } catch (e) {
    console.error('Failed to toggle suggested:', e)
  }
}

async function deleteMission(mission: Mission) {
  if (!confirm(`Delete mission "${mission.title}"? This cannot be undone.`)) return
  deletingId.value = mission.id
  try {
    await deleteDoc(doc(db, 'missions', mission.id))
  } catch (e) {
    console.error('Failed to delete mission:', e)
    alert('Failed to delete. Check permissions.')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">⚔️ Missions Board</h1>
      <button v-if="canManage" @click="openCreate" class="btn text-sm">+ New Mission</button>
    </div>

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
      <button @click="filterSuggested = !filterSuggested" :class="['px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-150', filterSuggested ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' : 'bg-white/[0.05] text-zinc-500 border border-white/10 hover:text-amber-400']" style="font-family: Manrope, sans-serif">⭐ Suggested</button>
      <div class="flex gap-1 ml-auto">
        <button @click="sortBy = 'unit'" :class="['px-3 py-1.5 rounded-full text-xs transition-all duration-150', sortBy === 'unit' ? 'bg-white/10 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400']">By Unit</button>
        <button @click="sortBy = 'votes'" :class="['px-3 py-1.5 rounded-full text-xs transition-all duration-150', sortBy === 'votes' ? 'bg-white/10 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400']">By Votes 👍</button>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading missions...</div>

    <div v-else-if="filteredMissions.length === 0" class="text-center py-12">
      <p class="text-zinc-500">No missions found.</p>
      <button v-if="canManage" @click="openCreate" class="btn text-sm mt-3">Create the first one</button>
    </div>

    <!-- Grouped by unit -->
    <div v-else-if="sortBy === 'unit'" class="space-y-10">
      <div v-for="(unitMissions, unitName, idx) in groupedMissions" :key="unitName"
        class="rounded-xl overflow-hidden"
        :style="{ borderLeft: `3px solid ${getGroupAccent(idx as number)}`, background: `linear-gradient(90deg, ${getGroupAccent(idx as number)}08 0%, transparent 40%)` }"
      >
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-xl font-bold text-zinc-200 flex items-center gap-2" style="font-family: Manrope, sans-serif">
            🛡️ {{ unitName }}
            <span class="text-zinc-600 text-sm font-normal">({{ unitMissions.length }} missions)</span>
          </h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-5 pb-5">
          <div v-for="mission in unitMissions" :key="mission.id" :class="['card p-4 relative z-10 flex flex-col', mission.suggested ? 'ring-1 ring-amber-500/30' : '']">
            <div class="relative z-10 flex items-start gap-3 flex-1">
              <!-- Vote button (left) -->
              <div v-if="auth.isAuthenticated && !auth.isGuest" class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
                <button
                  @click="toggleVote(mission)"
                  :class="['w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all', hasVoted(mission) ? 'bg-[#ef233c] text-white shadow-lg shadow-[#ef233c]/25' : 'bg-white/5 text-zinc-600 hover:bg-white/10 hover:text-zinc-300']"
                >👍</button>
                <span :class="['text-sm font-bold', getVoteCount(mission) > 0 ? 'text-[#ef233c]' : 'text-zinc-700']">{{ getVoteCount(mission) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span :class="tierBadgeClass[mission.tier] || 'tier'">T{{ mission.tier }}</span>
                  <span v-if="mission.suggested" class="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-semibold" style="font-family: Manrope, sans-serif">⭐ Suggested</span>
                  <span v-if="mission.status !== 'available'" :class="['text-xs px-2 py-0.5 rounded-md', mission.status === 'completed' ? 'bg-green-500/15 text-green-400' : mission.status === 'in_progress' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-red-500/15 text-red-400']">{{ mission.status.replace('_', ' ') }}</span>
                  <!-- Admin actions -->
                  <div v-if="canManage" class="ml-auto flex items-center gap-1.5">
                    <button @click="toggleSuggested(mission)" :class="['text-base transition-colors', mission.suggested ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-amber-400']" :title="mission.suggested ? 'Remove suggestion' : 'Mark as suggested'">{{ mission.suggested ? '⭐' : '☆' }}</button>
                    <button @click="openEdit(mission)" class="text-zinc-600 hover:text-zinc-300 text-base transition-colors" title="Edit">✏️</button>
                    <button @click="deleteMission(mission)" :disabled="deletingId === mission.id" class="text-zinc-600 hover:text-red-400 text-base transition-colors" title="Delete">
                      <span v-if="deletingId === mission.id" class="inline-block w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin"></span>
                      <span v-else>🗑️</span>
                    </button>
                  </div>
                </div>
                <h3 class="text-sm font-semibold text-zinc-100 mb-1" style="font-family: Manrope, sans-serif">{{ mission.title }}</h3>
                <p class="text-zinc-200 text-sm">{{ mission.description }}</p>
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
      <div v-for="mission in sortedByVotes" :key="mission.id" :class="['card p-4 relative z-10 flex flex-col', mission.suggested ? 'ring-1 ring-amber-500/30' : '']">
        <div class="relative z-10 flex items-start gap-3 flex-1">
          <!-- Vote button (left) -->
          <div v-if="auth.isAuthenticated && !auth.isGuest" class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
            <button
              @click="toggleVote(mission)"
              :class="['w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all', hasVoted(mission) ? 'bg-[#ef233c] text-white shadow-lg shadow-[#ef233c]/25' : 'bg-white/5 text-zinc-600 hover:bg-white/10 hover:text-zinc-300']"
            >👍</button>
            <span :class="['text-sm font-bold', getVoteCount(mission) > 0 ? 'text-[#ef233c]' : 'text-zinc-700']">{{ getVoteCount(mission) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span :class="tierBadgeClass[mission.tier] || 'tier'">T{{ mission.tier }}</span>
              <span class="text-xs text-zinc-600">{{ mission.unitName }}</span>
              <span v-if="mission.suggested" class="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-semibold" style="font-family: Manrope, sans-serif">⭐ Suggested</span>
              <span v-if="mission.status !== 'available'" :class="['text-xs px-2 py-0.5 rounded-md', mission.status === 'completed' ? 'bg-green-500/15 text-green-400' : mission.status === 'in_progress' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-red-500/15 text-red-400']">{{ mission.status.replace('_', ' ') }}</span>
              <!-- Admin actions -->
              <div v-if="canManage" class="ml-auto flex items-center gap-1.5">
                <button @click="toggleSuggested(mission)" :class="['text-base transition-colors', mission.suggested ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-amber-400']" :title="mission.suggested ? 'Remove suggestion' : 'Mark as suggested'">{{ mission.suggested ? '⭐' : '☆' }}</button>
                <button @click="openEdit(mission)" class="text-zinc-600 hover:text-zinc-300 text-base transition-colors" title="Edit">✏️</button>
                <button @click="deleteMission(mission)" :disabled="deletingId === mission.id" class="text-zinc-600 hover:text-red-400 text-base transition-colors" title="Delete">
                  <span v-if="deletingId === mission.id" class="inline-block w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin"></span>
                  <span v-else>🗑️</span>
                </button>
              </div>
            </div>
            <h3 class="text-sm font-semibold text-zinc-100 mb-1" style="font-family: Manrope, sans-serif">{{ mission.title }}</h3>
            <p class="text-zinc-200 text-sm">{{ mission.description }}</p>
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

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-all duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeModal">
          <div class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div class="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6">
            <h2 class="text-lg font-bold text-white mb-5" style="font-family: Manrope, sans-serif">
              {{ editingMission ? 'Edit Mission' : 'Create Mission' }}
            </h2>

            <div class="space-y-4">
              <!-- Unit -->
              <div>
                <label class="label text-xs mb-1 block">Unit / Organization</label>
                <select v-model="form.unitId" class="input w-full">
                  <option value="" disabled>Select unit...</option>
                  <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
                </select>
              </div>

              <!-- Title -->
              <div>
                <label class="label text-xs mb-1 block">Title</label>
                <input v-model="form.title" class="input w-full" placeholder="Mission title" />
              </div>

              <!-- Description -->
              <div>
                <label class="label text-xs mb-1 block">Description</label>
                <textarea v-model="form.description" class="input w-full" rows="3" placeholder="Mission description..." />
              </div>

              <!-- Tier & Status -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label text-xs mb-1 block">Tier (1-5)</label>
                  <input v-model.number="form.tier" type="number" min="1" max="5" class="input w-full" />
                </div>
                <div>
                  <label class="label text-xs mb-1 block">Status</label>
                  <select v-model="form.status" class="input w-full">
                    <option value="available">Available</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <!-- Duration -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label text-xs mb-1 block">Expected Duration (days)</label>
                  <input v-model.number="form.expectedDurationDays" type="number" min="0" class="input w-full" placeholder="Optional" />
                </div>
                <div>
                  <label class="label text-xs mb-1 block">Mission Duration (days)</label>
                  <input v-model.number="form.missionDurationDays" type="number" min="0" class="input w-full" placeholder="Optional" />
                </div>
              </div>

              <div>
                <label class="label text-xs mb-1 block">Duration Note</label>
                <input v-model="form.durationNote" class="input w-full" placeholder="e.g. unknown, up to 1 month" />
              </div>

              <!-- Pay -->
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="label text-xs mb-1 block">Pay Amount</label>
                  <input v-model.number="form.payAmount" type="number" min="0" class="input w-full" />
                </div>
                <div>
                  <label class="label text-xs mb-1 block">Pay Type</label>
                  <select v-model="form.payType" class="input w-full">
                    <option value="each">Each</option>
                    <option value="total">Total</option>
                    <option value="per_day">Per Day</option>
                    <option value="performance">Performance</option>
                  </select>
                </div>
                <div>
                  <label class="label text-xs mb-1 block">Currency</label>
                  <select v-model="form.payCurrency" class="input w-full">
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="label text-xs mb-1 block">Pay Note</label>
                <input v-model="form.payNote" class="input w-full" placeholder="e.g. most likely more than 50 gold each" />
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 mt-6">
              <button
                @click="saveMission"
                :disabled="saving || !form.unitId || !(form.title || '').trim() || !(form.description || '').trim()"
                class="btn text-sm flex items-center gap-2"
              >
                <span v-if="saving" class="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ saving ? 'Saving...' : (editingMission ? 'Save Changes' : 'Create Mission') }}
              </button>
              <button @click="closeModal" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

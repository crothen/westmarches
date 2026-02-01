<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { Mission } from '../types'

const missions = ref<Mission[]>([])
const loading = ref(true)
const filterTier = ref<number | null>(null)
const filterUnit = ref<string | null>(null)

onMounted(async () => {
  try {
    const snap = await getDocs(query(collection(db, 'missions'), orderBy('tier', 'asc')))
    missions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
  } catch (e) {
    console.error('Failed to load missions:', e)
  } finally {
    loading.value = false
  }
})

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

const tierBadgeClass: Record<number, string> = {
  2: 'tier-badge tier-2',
  3: 'tier-badge tier-3',
  4: 'tier-badge tier-4',
  5: 'tier-badge tier-5',
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
    <h1 class="text-2xl font-bold text-slate-100 mb-6">⚔️ Missions Board</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <select v-model="filterUnit" class="modern-input text-sm">
        <option :value="null">All Units</option>
        <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
      </select>
      <div class="flex gap-1">
        <button @click="filterTier = null" :class="['px-3 py-1.5 rounded-lg text-sm transition-all duration-150', !filterTier ? 'btn-primary !py-1.5' : 'btn-secondary !py-1.5']">All Tiers</button>
        <button v-for="t in [2,3,4,5]" :key="t" @click="filterTier = filterTier === t ? null : t" :class="['px-3 py-1.5 rounded-lg text-sm transition-all duration-150', filterTier === t ? 'btn-primary !py-1.5' : 'btn-secondary !py-1.5']">T{{ t }}</button>
      </div>
    </div>

    <div v-if="loading" class="text-slate-400 animate-pulse">Loading missions...</div>

    <div v-else-if="filteredMissions.length === 0" class="text-center py-12">
      <p class="text-slate-400">No missions found.</p>
    </div>

    <div v-else class="space-y-8">
      <div v-for="(unitMissions, unitName) in groupedMissions" :key="unitName">
        <h2 class="text-xl font-bold text-slate-200 mb-3 flex items-center gap-2">
          🛡️ {{ unitName }}
          <span class="text-slate-500 text-sm font-normal">({{ unitMissions.length }} missions)</span>
        </h2>
        <div class="space-y-2">
          <div v-for="mission in unitMissions" :key="mission.id" class="glass-card p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span :class="tierBadgeClass[mission.tier] || 'tier-badge'">T{{ mission.tier }}</span>
                  <span v-if="mission.status !== 'available'" :class="['text-xs px-2 py-0.5 rounded-md', mission.status === 'completed' ? 'bg-green-500/15 text-green-400' : mission.status === 'in_progress' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400']">{{ mission.status.replace('_', ' ') }}</span>
                </div>
                <p class="text-slate-200">{{ mission.description }}</p>
                <div class="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                  <span>⏱️ {{ formatDuration(mission) }}</span>
                  <span>💰 {{ formatPay(mission.pay) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

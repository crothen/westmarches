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

const tierColors: Record<number, string> = {
  2: 'bg-green-900/50 text-green-400 border-green-700',
  3: 'bg-blue-900/50 text-blue-400 border-blue-700',
  4: 'bg-purple-900/50 text-purple-400 border-purple-700',
  5: 'bg-red-900/50 text-red-400 border-red-700',
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
    <h1 class="text-3xl font-bold text-amber-500 mb-6">⚔️ Missions Board</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <select v-model="filterUnit" class="bg-stone-800 border border-stone-700 rounded px-3 py-1.5 text-stone-200 text-sm focus:border-amber-500 focus:outline-none">
        <option :value="null">All Units</option>
        <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
      </select>
      <div class="flex gap-1">
        <button @click="filterTier = null" :class="['px-3 py-1.5 rounded text-sm border transition-colors', !filterTier ? 'bg-amber-600 text-stone-900 border-amber-500' : 'bg-stone-800 text-stone-400 border-stone-700 hover:border-stone-500']">All Tiers</button>
        <button v-for="t in [2,3,4,5]" :key="t" @click="filterTier = filterTier === t ? null : t" :class="['px-3 py-1.5 rounded text-sm border transition-colors', filterTier === t ? 'bg-amber-600 text-stone-900 border-amber-500' : 'bg-stone-800 text-stone-400 border-stone-700 hover:border-stone-500']">T{{ t }}</button>
      </div>
    </div>

    <div v-if="loading" class="text-stone-400 animate-pulse">Loading missions...</div>

    <div v-else-if="filteredMissions.length === 0" class="text-center py-12">
      <p class="text-stone-400">No missions found.</p>
    </div>

    <div v-else class="space-y-8">
      <div v-for="(unitMissions, unitName) in groupedMissions" :key="unitName">
        <h2 class="text-xl font-bold text-stone-200 mb-3 flex items-center gap-2">
          🛡️ {{ unitName }}
          <span class="text-stone-500 text-sm font-normal">({{ unitMissions.length }} missions)</span>
        </h2>
        <div class="space-y-2">
          <div v-for="mission in unitMissions" :key="mission.id" class="bg-stone-800 border border-stone-700 rounded-lg p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span :class="['text-xs font-bold px-2 py-0.5 rounded border', tierColors[mission.tier] || 'bg-stone-700 text-stone-400 border-stone-600']">T{{ mission.tier }}</span>
                  <span v-if="mission.status !== 'available'" :class="['text-xs px-2 py-0.5 rounded', mission.status === 'completed' ? 'bg-green-900/50 text-green-400' : mission.status === 'in_progress' ? 'bg-amber-900/50 text-amber-400' : 'bg-red-900/50 text-red-400']">{{ mission.status.replace('_', ' ') }}</span>
                </div>
                <p class="text-stone-200">{{ mission.description }}</p>
                <div class="flex flex-wrap gap-4 mt-2 text-sm text-stone-400">
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

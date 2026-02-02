<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { SessionLog } from '../types'

const sessions = ref<SessionLog[]>([])
const loading = ref(true)

let _unsub: (() => void) | null = null

onMounted(() => {
  const q = query(collection(db, 'sessions'), orderBy('sessionNumber', 'desc'))
  _unsub = onSnapshot(q, (snap) => {
    sessions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionLog))
    loading.value = false
  }, (e) => {
    console.error('Failed to load sessions:', e)
    loading.value = false
  })
})

onUnmounted(() => _unsub?.())
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📖 Session Log</h1>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading sessions...</div>

    <div v-else-if="sessions.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📜</div>
      <p class="text-zinc-500">No sessions recorded yet.</p>
      <p class="text-zinc-600 text-sm mt-1">The adventure awaits...</p>
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="session in sessions"
        :key="session.id"
        :to="`/sessions/${session.id}`"
        class="block card p-4 group relative z-10"
      >
        <div class="relative z-10 flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3 mb-1">
              <span class="text-[#ef233c] font-bold text-lg" style="font-family: Manrope, sans-serif">Session {{ session.sessionNumber }}</span>
              <span class="text-zinc-600 text-sm">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
            </div>
            <h2 class="text-zinc-100 font-semibold group-hover:text-[#ef233c] transition-colors">{{ session.title }}</h2>
            <p class="text-zinc-500 text-sm mt-1 line-clamp-2">{{ session.summary }}</p>
          </div>
          <div class="text-zinc-600 text-sm shrink-0 ml-4">
            {{ session.participants?.length || 0 }} adventurers
          </div>
        </div>
        <div v-if="session.tags?.length" class="relative z-10 flex gap-2 mt-3 flex-wrap">
          <span v-for="tag in session.tags" :key="tag" class="text-xs bg-white/[0.05] text-zinc-500 px-2 py-0.5 rounded-md border border-white/[0.06]">{{ tag }}</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

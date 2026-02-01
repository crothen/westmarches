<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { SessionLog } from '../types'

const sessions = ref<SessionLog[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const q = query(collection(db, 'sessions'), orderBy('sessionNumber', 'desc'))
    const snap = await getDocs(q)
    sessions.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionLog))
  } catch (e) {
    console.error('Failed to load sessions:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-100">📖 Session Log</h1>
    </div>

    <div v-if="loading" class="text-slate-400 animate-pulse">Loading sessions...</div>

    <div v-else-if="sessions.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📜</div>
      <p class="text-slate-400">No sessions recorded yet.</p>
      <p class="text-slate-500 text-sm mt-1">The adventure awaits...</p>
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="session in sessions"
        :key="session.id"
        :to="`/sessions/${session.id}`"
        class="block glass-card p-4 group"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3 mb-1">
              <span class="text-amber-500 font-bold text-lg">Session {{ session.sessionNumber }}</span>
              <span class="text-slate-500 text-sm">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
            </div>
            <h2 class="text-slate-100 font-semibold group-hover:text-amber-500 transition-colors">{{ session.title }}</h2>
            <p class="text-slate-400 text-sm mt-1 line-clamp-2">{{ session.summary }}</p>
          </div>
          <div class="text-slate-500 text-sm shrink-0 ml-4">
            {{ session.participants?.length || 0 }} adventurers
          </div>
        </div>
        <div v-if="session.tags?.length" class="flex gap-2 mt-3 flex-wrap">
          <span v-for="tag in session.tags" :key="tag" class="text-xs bg-white/[0.05] text-slate-400 px-2 py-0.5 rounded-md border border-white/[0.06]">{{ tag }}</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

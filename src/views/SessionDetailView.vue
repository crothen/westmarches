<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { SessionLog } from '../types'

const route = useRoute()
const session = ref<SessionLog | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const snap = await getDoc(doc(db, 'sessions', route.params.id as string))
    if (snap.exists()) {
      session.value = { id: snap.id, ...snap.data() } as SessionLog
    }
  } catch (e) {
    console.error('Failed to load session:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <RouterLink to="/sessions" class="text-amber-500 hover:text-amber-400 text-sm mb-4 inline-block">← Back to Sessions</RouterLink>

    <div v-if="loading" class="text-stone-400 animate-pulse">Loading...</div>

    <div v-else-if="!session" class="text-center py-12">
      <p class="text-stone-400">Session not found.</p>
    </div>

    <div v-else>
      <div class="flex items-center gap-3 mb-2">
        <span class="text-amber-500 font-bold text-2xl">Session {{ session.sessionNumber }}</span>
        <span class="text-stone-500">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
      </div>
      <h1 class="text-3xl font-bold text-stone-100 mb-6">{{ session.title }}</h1>

      <!-- Participants -->
      <div v-if="session.participants?.length" class="mb-6">
        <h2 class="text-lg font-semibold text-amber-500 mb-2">🧙 Adventurers</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="p in session.participants" :key="p.characterId" class="bg-stone-800 border border-stone-700 text-stone-200 px-3 py-1 rounded text-sm">
            {{ p.characterName }}
          </span>
        </div>
      </div>

      <!-- Summary -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-amber-500 mb-2">📜 Summary</h2>
        <div class="bg-stone-800 border border-stone-700 rounded-lg p-4 text-stone-300 whitespace-pre-wrap">{{ session.summary }}</div>
      </div>

      <!-- Loot -->
      <div v-if="session.loot?.length" class="mb-6">
        <h2 class="text-lg font-semibold text-amber-500 mb-2">💰 Loot</h2>
        <div class="bg-stone-800 border border-stone-700 rounded-lg divide-y divide-stone-700">
          <div v-for="(item, i) in session.loot" :key="i" class="p-3 flex items-center justify-between">
            <div>
              <span class="text-stone-100">{{ item.name }}</span>
              <span v-if="item.quantity > 1" class="text-stone-500 ml-1">×{{ item.quantity }}</span>
              <span v-if="item.description" class="text-stone-500 text-sm ml-2">— {{ item.description }}</span>
            </div>
            <span v-if="item.recipient" class="text-stone-400 text-sm">→ {{ item.recipient }}</span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="session.tags?.length" class="flex gap-2 flex-wrap">
        <span v-for="tag in session.tags" :key="tag" class="text-xs bg-stone-700 text-stone-400 px-2 py-0.5 rounded">{{ tag }}</span>
      </div>
    </div>
  </div>
</template>

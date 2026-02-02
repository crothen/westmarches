<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import SessionForm from '../components/sessions/SessionForm.vue'
import type { SessionLog } from '../types'

const auth = useAuthStore()
const sessions = ref<SessionLog[]>([])
const loading = ref(true)
const showCreateForm = ref(false)
const saving = ref(false)

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

const canCreate = computed(() => auth.isDm || auth.isAdmin)

const nextSessionNumber = computed(() => {
  if (sessions.value.length === 0) return 1
  return Math.max(...sessions.value.map(s => s.sessionNumber)) + 1
})

async function handleCreate(data: Partial<SessionLog>) {
  saving.value = true
  try {
    await addDoc(collection(db, 'sessions'), {
      ...data,
      date: Timestamp.fromDate(new Date(data.date as any)),
      dmId: auth.firebaseUser?.uid || '',
      dmName: auth.appUser?.displayName || '',
      locationsVisited: [],
      loot: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    showCreateForm.value = false
  } catch (e) {
    console.error('Failed to create session:', e)
    alert('Failed to create session.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📖 Sessions</h1>
      <button
        v-if="canCreate"
        @click="showCreateForm = !showCreateForm"
        class="btn !text-sm"
      >
        {{ showCreateForm ? '✕ Cancel' : '+ Create Session' }}
      </button>
    </div>

    <!-- Create Form -->
    <div v-if="showCreateForm" class="card-flat p-5 mb-6">
      <h2 class="text-lg font-semibold text-[#ef233c] mb-4" style="font-family: Manrope, sans-serif">📝 New Session</h2>
      <SessionForm
        :next-session-number="nextSessionNumber"
        @submit="handleCreate"
        @cancel="showCreateForm = false"
      />
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading sessions...</div>

    <div v-else-if="sessions.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📜</div>
      <p class="text-zinc-500">No sessions recorded yet.</p>
      <p class="text-zinc-600 text-sm mt-1">The adventure awaits...</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <RouterLink
        v-for="session in sessions"
        :key="session.id"
        :to="`/sessions/${session.id}`"
        class="block card group relative z-10 overflow-hidden"
      >
        <!-- Hero image (3:1 aspect ratio to match generated art) -->
        <div v-if="(session as any).imageUrl" class="w-full overflow-hidden" style="aspect-ratio: 3 / 1">
          <img :src="(session as any).imageUrl" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
        <div v-else class="w-full h-20 bg-gradient-to-br from-[#ef233c]/10 to-transparent" />

        <div class="relative z-10 p-4">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="text-[#ef233c] font-bold text-sm" style="font-family: Manrope, sans-serif">Session {{ session.sessionNumber }}</span>
            <span class="text-zinc-600 text-xs">{{ (session.date as any)?.toDate ? new Date((session.date as any).toDate()).toLocaleDateString() : '' }}</span>
            <span v-if="session.sessionLocationName" class="text-zinc-600 text-xs">📍 {{ session.sessionLocationName }}</span>
          </div>
          <h2 class="text-zinc-100 font-semibold group-hover:text-[#ef233c] transition-colors text-sm">{{ session.title }}</h2>
          <p class="text-zinc-500 text-xs mt-1.5 line-clamp-2">{{ session.summary }}</p>
          <div class="flex items-center justify-between mt-3">
            <div class="text-zinc-600 text-xs">
              {{ session.participants?.length || 0 }} adventurers
            </div>
            <div class="flex items-center gap-2">
              <RouterLink
                :to="`/sessions/${session.id}/read`"
                class="text-[0.65rem] text-zinc-600 hover:text-[#ef233c] transition-colors relative z-20"
                @click.stop
              >
                📖 Read
              </RouterLink>
              <div v-if="session.tags?.length" class="flex gap-1 flex-wrap justify-end">
                <span v-for="tag in session.tags.slice(0, 3)" :key="tag" class="text-[0.6rem] bg-white/[0.05] text-zinc-500 px-1.5 py-0.5 rounded border border-white/[0.06]">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import MentionText from '../components/common/MentionText.vue'
import type { HexNote, NpcNote, SessionNote, Comment } from '../types'

const auth = useAuthStore()
const loading = ref(true)
const searchQuery = ref('')
const activeFilter = ref<'all' | 'hex' | 'npc' | 'session' | 'comment'>('all')

interface NoteItem {
  id: string
  type: 'hex' | 'npc' | 'session' | 'comment'
  content: string
  sourceName: string
  sourceLink: string
  createdAt: Date
  isPrivate?: boolean
}

const allNotes = ref<NoteItem[]>([])

// Resolve names for linked entities
const npcNames = ref<Record<string, string>>({})
const sessionTitles = ref<Record<string, string>>({})
const locationNames = ref<Record<string, string>>({})
const characterNames = ref<Record<string, string>>({})
const orgNames = ref<Record<string, string>>({})

function toDate(val: any): Date {
  if (!val) return new Date(0)
  if (val.toDate) return val.toDate()
  if (val instanceof Date) return val
  return new Date(val)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getSourceName(type: string, targetType: string, targetId: string): string {
  if (type === 'comment') {
    switch (targetType) {
      case 'npc': return npcNames.value[targetId] || `NPC ${targetId.slice(0, 6)}…`
      case 'character': return characterNames.value[targetId] || `Character ${targetId.slice(0, 6)}…`
      case 'location': return locationNames.value[targetId] || `Location ${targetId.slice(0, 6)}…`
      case 'organization': return orgNames.value[targetId] || `Organization ${targetId.slice(0, 6)}…`
      case 'hex': {
        const parts = targetId.split('_')
        return `Hex ${parts[0]}, ${parts[1]}`
      }
      default: return `${targetType} ${targetId.slice(0, 6)}…`
    }
  }
  return ''
}

function getSourceLink(type: string, targetType: string, targetId: string): string {
  if (type === 'comment') {
    switch (targetType) {
      case 'npc': return `/npcs/${targetId}`
      case 'character': return `/characters/${targetId}`
      case 'location': return `/locations/${targetId}`
      case 'organization': return `/organizations`
      case 'hex': return `/map?hex=${targetId}`
      default: return '#'
    }
  }
  return '#'
}

async function resolveEntityNames(ids: { npcIds: Set<string>, sessionIds: Set<string>, locationIds: Set<string>, characterIds: Set<string>, orgIds: Set<string> }) {
  const promises: Promise<void>[] = []

  // Resolve NPC names
  for (const id of ids.npcIds) {
    promises.push(
      getDoc(doc(db, 'npcs', id)).then(snap => {
        if (snap.exists()) npcNames.value[id] = snap.data().name || 'Unknown NPC'
      }).catch(() => {})
    )
  }

  // Resolve session titles
  for (const id of ids.sessionIds) {
    promises.push(
      getDoc(doc(db, 'sessions', id)).then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          sessionTitles.value[id] = data.title || `Session ${data.sessionNumber || '?'}`
        }
      }).catch(() => {})
    )
  }

  // Resolve location names
  for (const id of ids.locationIds) {
    promises.push(
      getDoc(doc(db, 'locations', id)).then(snap => {
        if (snap.exists()) locationNames.value[id] = snap.data().name || 'Unknown Location'
      }).catch(() => {})
    )
  }

  // Resolve character names
  for (const id of ids.characterIds) {
    promises.push(
      getDoc(doc(db, 'characters', id)).then(snap => {
        if (snap.exists()) characterNames.value[id] = snap.data().name || 'Unknown Character'
      }).catch(() => {})
    )
  }

  // Resolve org names
  for (const id of ids.orgIds) {
    promises.push(
      getDoc(doc(db, 'organizations', id)).then(snap => {
        if (snap.exists()) orgNames.value[id] = snap.data().name || 'Unknown Org'
      }).catch(() => {})
    )
  }

  await Promise.all(promises)
}

const _unsubs: (() => void)[] = []

// Raw snapshot data
const rawHexNotes = ref<any[]>([])
const rawNpcNotes = ref<any[]>([])
const rawSessionNotes = ref<any[]>([])
const rawComments = ref<any[]>([])

async function recomputeAllNotes() {
  const notes: NoteItem[] = []
  const entityIds = {
    npcIds: new Set<string>(),
    sessionIds: new Set<string>(),
    locationIds: new Set<string>(),
    characterIds: new Set<string>(),
    orgIds: new Set<string>()
  }

  // Hex Notes
  rawHexNotes.value.forEach(({ id, data }) => {
    if (data.deleted) return
    const parts = data.hexKey.split('_')
    notes.push({
      id,
      type: 'hex',
      content: data.content,
      sourceName: `Hex ${parts[0]}, ${parts[1]}`,
      sourceLink: `/map?hex=${data.hexKey}`,
      createdAt: toDate(data.createdAt),
      isPrivate: data.isPrivate
    })
  })

  // NPC Notes
  rawNpcNotes.value.forEach(({ id, data }) => {
    if (data.deleted) return
    entityIds.npcIds.add(data.npcId)
    notes.push({
      id,
      type: 'npc',
      content: data.content,
      sourceName: data.npcId,
      sourceLink: `/npcs/${data.npcId}`,
      createdAt: toDate(data.createdAt),
      isPrivate: data.isPrivate
    })
  })

  // Session Notes
  rawSessionNotes.value.forEach(({ id, data }) => {
    if (data.deleted) return
    entityIds.sessionIds.add(data.sessionId)
    notes.push({
      id,
      type: 'session',
      content: data.content,
      sourceName: data.sessionId,
      sourceLink: `/sessions/${data.sessionId}`,
      createdAt: toDate(data.createdAt),
      isPrivate: data.isPrivate
    })
  })

  // Comments
  rawComments.value.forEach(({ id, data }) => {
    switch (data.targetType) {
      case 'npc': entityIds.npcIds.add(data.targetId); break
      case 'character': entityIds.characterIds.add(data.targetId); break
      case 'location': entityIds.locationIds.add(data.targetId); break
      case 'organization': entityIds.orgIds.add(data.targetId); break
    }
    notes.push({
      id,
      type: 'comment',
      content: data.content,
      sourceName: `${data.targetType}:${data.targetId}`,
      sourceLink: getSourceLink('comment', data.targetType, data.targetId),
      createdAt: toDate(data.createdAt),
      isPrivate: data.isPrivate
    })
  })

  // Resolve entity names
  await resolveEntityNames(entityIds)

  // Update source names
  notes.forEach(note => {
    if (note.type === 'npc') {
      const npcId = note.sourceName
      note.sourceName = npcNames.value[npcId] || `NPC ${npcId.slice(0, 6)}…`
    }
    if (note.type === 'session') {
      const sessionId = note.sourceName
      note.sourceName = sessionTitles.value[sessionId] || `Session ${sessionId.slice(0, 6)}…`
    }
    if (note.type === 'comment') {
      const [targetType, targetId] = note.sourceName.split(':')
      note.sourceName = getSourceName('comment', targetType!, targetId!)
    }
  })

  notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  allNotes.value = notes
  loading.value = false
}

onMounted(() => {
  if (!auth.firebaseUser) { loading.value = false; return }
  const uid = auth.firebaseUser.uid

  _unsubs.push(onSnapshot(query(collection(db, 'hexNotes'), where('userId', '==', uid)), (snap) => {
    rawHexNotes.value = snap.docs.map(d => ({ id: d.id, data: d.data() as HexNote & { deleted?: boolean } }))
    recomputeAllNotes()
  }, (e) => { console.error('Failed to load hex notes:', e); loading.value = false }))

  _unsubs.push(onSnapshot(query(collection(db, 'npcNotes'), where('userId', '==', uid)), (snap) => {
    rawNpcNotes.value = snap.docs.map(d => ({ id: d.id, data: d.data() as NpcNote & { deleted?: boolean } }))
    recomputeAllNotes()
  }, (e) => { console.error('Failed to load npc notes:', e); loading.value = false }))

  _unsubs.push(onSnapshot(query(collection(db, 'sessionNotes'), where('userId', '==', uid)), (snap) => {
    rawSessionNotes.value = snap.docs.map(d => ({ id: d.id, data: d.data() as SessionNote & { deleted?: boolean } }))
    recomputeAllNotes()
  }, (e) => { console.error('Failed to load session notes:', e); loading.value = false }))

  _unsubs.push(onSnapshot(query(collection(db, 'comments'), where('authorId', '==', uid)), (snap) => {
    rawComments.value = snap.docs.map(d => ({ id: d.id, data: d.data() as Comment }))
    recomputeAllNotes()
  }, (e) => { console.error('Failed to load comments:', e); loading.value = false }))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const filteredNotes = computed(() => {
  let notes = allNotes.value

  // Filter by type
  if (activeFilter.value !== 'all') {
    notes = notes.filter(n => n.type === activeFilter.value)
  }

  // Search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    notes = notes.filter(n =>
      n.content.toLowerCase().includes(q) ||
      n.sourceName.toLowerCase().includes(q)
    )
  }

  return notes
})

const groupedNotes = computed(() => {
  if (activeFilter.value !== 'all') {
    return [{ type: activeFilter.value, notes: filteredNotes.value }]
  }

  const groups: { type: string; notes: NoteItem[] }[] = []
  const typeOrder = ['hex', 'npc', 'session', 'comment'] as const
  const typeLabels: Record<string, string> = {
    hex: 'Hex Notes',
    npc: 'NPC Notes',
    session: 'Session Notes',
    comment: 'Comments'
  }

  for (const type of typeOrder) {
    const items = filteredNotes.value.filter(n => n.type === type)
    if (items.length > 0) {
      groups.push({ type: typeLabels[type]!, notes: items })
    }
  }

  return groups
})

const typeCounts = computed(() => {
  const counts: Record<string, number> = { all: allNotes.value.length }
  for (const note of allNotes.value) {
    counts[note.type] = (counts[note.type] || 0) + 1
  }
  return counts
})

const typeIcons: Record<string, string> = {
  hex: '🗺️',
  npc: '👤',
  session: '📖',
  comment: '💬'
}

const typeLabel: Record<string, string> = {
  hex: 'Hex Notes',
  npc: 'NPC Notes',
  session: 'Session Notes',
  comment: 'Comments'
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">📝 My Notes</h1>
      <span class="text-zinc-600 text-sm">{{ allNotes.length }} total</span>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading your notes...</div>

    <template v-else>
      <!-- Search & Filters -->
      <div class="mb-5 space-y-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search notes..."
          class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#ef233c]/40 transition-colors"
        />

        <div class="flex flex-wrap gap-1.5">
          <button
            @click="activeFilter = 'all'"
            :class="[
              'text-xs px-3 py-1.5 rounded-lg transition-colors font-medium',
              activeFilter === 'all' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
            ]"
          >
            All ({{ typeCounts.all || 0 }})
          </button>
          <button
            v-for="type in ['hex', 'npc', 'session', 'comment']"
            :key="type"
            @click="activeFilter = type as any"
            :class="[
              'text-xs px-3 py-1.5 rounded-lg transition-colors font-medium',
              activeFilter === type ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
            ]"
          >
            {{ typeIcons[type] }} {{ typeLabel[type] }} ({{ typeCounts[type] || 0 }})
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="allNotes.length === 0" class="text-center py-12">
        <div class="text-4xl mb-3">📝</div>
        <p class="text-zinc-500">You haven't written any notes yet.</p>
        <p class="text-zinc-600 text-sm mt-1">Explore the world and leave your mark!</p>
      </div>

      <!-- No results from search -->
      <div v-else-if="filteredNotes.length === 0" class="text-center py-12">
        <div class="text-4xl mb-3">🔍</div>
        <p class="text-zinc-500">No notes match your search.</p>
      </div>

      <!-- Grouped notes -->
      <div v-else class="space-y-6">
        <div v-for="group in groupedNotes" :key="group.type">
          <h2 v-if="activeFilter === 'all'" class="text-sm font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3" style="font-family: Manrope, sans-serif">
            {{ group.type }}
          </h2>

          <div class="space-y-2">
            <div
              v-for="note in group.notes"
              :key="note.id"
              class="card p-4 group"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-base">{{ typeIcons[note.type] }}</span>
                  <RouterLink
                    :to="note.sourceLink"
                    class="text-[#ef233c] text-sm font-medium hover:text-[#ef233c]/80 transition-colors"
                  >
                    {{ note.sourceName }}
                  </RouterLink>
                  <span v-if="note.isPrivate" class="text-[0.6rem] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md border border-red-500/20">🔒 Private</span>
                </div>
                <span class="text-zinc-600 text-xs shrink-0 ml-3">{{ formatDate(note.createdAt) }}</span>
              </div>
              <p class="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed"><MentionText :text="note.content" /></p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

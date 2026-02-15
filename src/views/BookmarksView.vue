<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const loading = ref(true)
const searchQuery = ref('')
const activeFilter = ref<string>('all')
const editingNote = ref<string | null>(null)
const editNoteText = ref('')

interface Bookmark {
  id: string
  type: string
  slug: string
  name: string
  url: string
  image?: string
  note?: string
  savedAt: Date
}

const bookmarks = ref<Bookmark[]>([])
let _unsub: (() => void) | null = null

function toDate(val: any): Date {
  if (!val) return new Date(0)
  if (val.toDate) return val.toDate()
  if (val instanceof Date) return val
  return new Date(val)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => {
  if (!auth.firebaseUser) { loading.value = false; return }
  const uid = auth.firebaseUser.uid

  _unsub = onSnapshot(
    query(collection(db, 'userBookmarks'), where('userId', '==', uid)),
    (snap) => {
      bookmarks.value = snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          type: data.type || 'item',
          slug: data.slug || '',
          name: data.name || 'Unknown',
          url: data.url || '',
          image: data.image || null,
          note: data.note || null,
          savedAt: toDate(data.savedAt)
        }
      }).sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())
      loading.value = false
    },
    (e) => {
      console.error('Failed to load bookmarks:', e)
      loading.value = false
    }
  )
})

onUnmounted(() => _unsub?.())

const typeLabels: Record<string, string> = {
  'item': '⚔️ Equipment',
  'magic-item': '✨ Magic Items',
  'spell': '📜 Spells',
  'monster': '👹 Monsters',
  'feat': '🎯 Feats',
  'race': '🧬 Races',
  'class': '⚔️ Classes',
  'subclass': '🔱 Subclasses',
  'background': '📖 Backgrounds',
  'vehicle': '🚗 Vehicles'
}

const typeIcons: Record<string, string> = {
  'item': '⚔️',
  'magic-item': '✨',
  'spell': '📜',
  'monster': '👹',
  'feat': '🎯',
  'race': '🧬',
  'class': '⚔️',
  'subclass': '🔱',
  'background': '📖',
  'vehicle': '🚗'
}

const availableTypes = computed(() => {
  const types = new Set(bookmarks.value.map(b => b.type))
  return Array.from(types).sort()
})

const typeCounts = computed(() => {
  const counts: Record<string, number> = { all: bookmarks.value.length }
  for (const b of bookmarks.value) {
    counts[b.type] = (counts[b.type] || 0) + 1
  }
  return counts
})

const filteredBookmarks = computed(() => {
  let items = bookmarks.value

  if (activeFilter.value !== 'all') {
    items = items.filter(b => b.type === activeFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.note && b.note.toLowerCase().includes(q))
    )
  }

  return items
})

function startEditNote(bookmark: Bookmark) {
  editingNote.value = bookmark.id
  editNoteText.value = bookmark.note || ''
}

async function saveNote(bookmark: Bookmark) {
  try {
    await updateDoc(doc(db, 'userBookmarks', bookmark.id), {
      note: editNoteText.value.trim() || null
    })
    editingNote.value = null
  } catch (e) {
    console.error('Failed to save note:', e)
  }
}

function cancelEditNote() {
  editingNote.value = null
  editNoteText.value = ''
}

async function removeBookmark(bookmark: Bookmark) {
  if (!confirm(`Remove "${bookmark.name}" from saved?`)) return
  try {
    await deleteDoc(doc(db, 'userBookmarks', bookmark.id))
  } catch (e) {
    console.error('Failed to remove bookmark:', e)
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">⭐ Saved</h1>
      <span class="text-zinc-600 text-sm">{{ bookmarks.length }} items</span>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading your saved items...</div>

    <template v-else>
      <!-- Search & Filters -->
      <div class="mb-5 space-y-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search saved items..."
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
            v-for="type in availableTypes"
            :key="type"
            @click="activeFilter = type"
            :class="[
              'text-xs px-3 py-1.5 rounded-lg transition-colors font-medium',
              activeFilter === type ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
            ]"
          >
            {{ typeIcons[type] || '📦' }} {{ typeLabels[type] || type }} ({{ typeCounts[type] || 0 }})
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="bookmarks.length === 0" class="text-center py-12">
        <div class="text-4xl mb-3">⭐</div>
        <p class="text-zinc-500">You haven't saved anything yet.</p>
        <p class="text-zinc-600 text-sm mt-1">Use the Chrome extension to star items on D&D Beyond!</p>
      </div>

      <!-- No results from search -->
      <div v-else-if="filteredBookmarks.length === 0" class="text-center py-12">
        <div class="text-4xl mb-3">🔍</div>
        <p class="text-zinc-500">No saved items match your search.</p>
      </div>

      <!-- Bookmark grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="bookmark in filteredBookmarks"
          :key="bookmark.id"
          class="card p-4 group relative"
        >
          <!-- Remove button -->
          <button
            @click="removeBookmark(bookmark)"
            class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 text-sm"
            title="Remove from saved"
          >
            ✕
          </button>

          <div class="flex gap-3">
            <!-- Image -->
            <div v-if="bookmark.image" class="shrink-0">
              <img
                :src="bookmark.image"
                :alt="bookmark.name"
                class="w-16 h-16 object-cover rounded-lg border border-white/[0.08]"
              />
            </div>
            <div v-else class="w-16 h-16 shrink-0 bg-white/[0.04] rounded-lg flex items-center justify-center text-2xl">
              {{ typeIcons[bookmark.type] || '📦' }}
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <a
                :href="bookmark.url"
                target="_blank"
                rel="noopener"
                class="text-[#ef233c] font-medium hover:text-[#ef233c]/80 transition-colors block truncate"
              >
                {{ bookmark.name }}
              </a>
              <div class="text-xs text-zinc-600 mt-0.5">
                {{ typeLabels[bookmark.type] || bookmark.type }} · {{ formatDate(bookmark.savedAt) }}
              </div>
            </div>
          </div>

          <!-- Note section -->
          <div class="mt-3">
            <template v-if="editingNote === bookmark.id">
              <textarea
                v-model="editNoteText"
                rows="2"
                class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#ef233c]/40 resize-none"
                placeholder="Add a note..."
              />
              <div class="flex gap-2 mt-2">
                <button
                  @click="saveNote(bookmark)"
                  class="text-xs px-3 py-1.5 bg-[#ef233c]/15 text-[#ef233c] rounded-lg hover:bg-[#ef233c]/25 transition-colors"
                >
                  Save
                </button>
                <button
                  @click="cancelEditNote"
                  class="text-xs px-3 py-1.5 bg-white/[0.04] text-zinc-500 rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </template>
            <template v-else>
              <p v-if="bookmark.note" class="text-zinc-400 text-sm whitespace-pre-wrap">{{ bookmark.note }}</p>
              <button
                @click="startEditNote(bookmark)"
                class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-1"
              >
                {{ bookmark.note ? '✏️ Edit note' : '+ Add note' }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

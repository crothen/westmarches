<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, query, orderBy, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { Character } from '../types'

const auth = useAuthStore()
const characters = ref<Character[]>([])
const users = ref<{ uid: string; displayName: string }[]>([])
const loading = ref(true)
const showCreate = ref(false)

const newChar = ref({ name: '', race: '', class: '', level: 1, description: '' })

onMounted(async () => {
  try {
    const [charSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, 'characters'), orderBy('name', 'asc'))),
      getDocs(query(collection(db, 'users'), orderBy('displayName', 'asc')))
    ])
    characters.value = charSnap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
    users.value = userSnap.docs.map(d => ({ uid: d.id, displayName: d.data().displayName || d.data().email || d.id }))
  } catch (e) {
    console.error('Failed to load:', e)
  } finally {
    loading.value = false
  }
})

const myCharacters = computed(() => {
  if (!auth.firebaseUser) return []
  return characters.value.filter(c => c.userId === auth.firebaseUser!.uid)
})

const otherCharacters = computed(() => {
  if (!auth.firebaseUser) return characters.value
  return characters.value.filter(c => c.userId !== auth.firebaseUser!.uid)
})

function getOwnerName(userId?: string): string {
  if (!userId) return 'Unassigned'
  const u = users.value.find(u => u.uid === userId)
  return u?.displayName || 'Unknown'
}

async function createCharacter() {
  if (!newChar.value.name.trim()) return
  const data = {
    name: newChar.value.name.trim(),
    race: newChar.value.race.trim(),
    class: newChar.value.class.trim(),
    level: newChar.value.level,
    description: newChar.value.description.trim(),
    userId: auth.firebaseUser?.uid || null,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
  try {
    const docRef = await addDoc(collection(db, 'characters'), data)
    characters.value.push({ id: docRef.id, ...data } as any)
    newChar.value = { name: '', race: '', class: '', level: 1, description: '' }
    showCreate.value = false
  } catch (e) {
    console.error('Failed to create:', e)
    alert('Failed to create character.')
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">🧙 Characters</h1>
      <button v-if="auth.isAuthenticated" @click="showCreate = !showCreate" class="btn text-sm">
        {{ showCreate ? 'Cancel' : '+ New Character' }}
      </button>
    </div>

    <!-- Create form -->
    <div v-if="showCreate" class="card p-5 mb-6 relative z-10">
      <div class="relative z-10 space-y-3">
        <h3 class="text-zinc-200 font-semibold" style="font-family: Manrope, sans-serif">Create Character</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label class="label text-xs block mb-1">Name *</label><input v-model="newChar.name" class="input w-full" /></div>
          <div><label class="label text-xs block mb-1">Race</label><input v-model="newChar.race" class="input w-full" placeholder="e.g. Human, Elf" /></div>
          <div><label class="label text-xs block mb-1">Class</label><input v-model="newChar.class" class="input w-full" placeholder="e.g. Fighter, Wizard" /></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><label class="label text-xs block mb-1">Level</label><input v-model.number="newChar.level" type="number" min="1" max="20" class="input w-full" /></div>
          <div class="md:col-span-3"><label class="label text-xs block mb-1">Description</label><input v-model="newChar.description" class="input w-full" placeholder="Brief description..." /></div>
        </div>
        <button @click="createCharacter" :disabled="!newChar.name.trim()" class="btn text-sm">Create</button>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading characters...</div>

    <div v-else-if="characters.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">🧙</div>
      <p class="text-zinc-500">No characters yet.</p>
    </div>

    <div v-else class="space-y-6">
      <!-- My characters -->
      <div v-if="myCharacters.length > 0">
        <h2 class="label mb-3">Your Characters</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <RouterLink v-for="c in myCharacters" :key="c.id" :to="`/characters/${c.id}`" class="card relative z-10 group cursor-pointer">
            <div class="relative z-10 flex gap-4 p-4">
              <!-- Thumbnail -->
              <div class="shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <img v-if="c.imageUrl" :src="c.imageUrl" :alt="c.name" class="w-full h-full object-cover" />
                <span v-else class="text-2xl opacity-30">🧙</span>
              </div>
              <!-- Info -->
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-semibold text-white truncate" style="font-family: Manrope, sans-serif">{{ c.name }}</h3>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  <span v-if="c.race" class="text-sm text-zinc-500">{{ c.race }}</span>
                  <span v-if="c.class" class="text-sm text-zinc-400">{{ c.class }}</span>
                  <span class="badge bg-[#ef233c]/15 text-[#ef233c]">Lv {{ c.level }}</span>
                  <span v-if="!c.isActive" class="badge bg-zinc-800 text-zinc-500">Inactive</span>
                </div>
                <p v-if="c.description" class="text-zinc-500 text-sm mt-1 line-clamp-1">{{ c.description }}</p>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>

      <!-- Other characters -->
      <div>
        <h2 class="label mb-3">{{ myCharacters.length > 0 ? 'Other Characters' : 'All Characters' }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <RouterLink v-for="c in otherCharacters" :key="c.id" :to="`/characters/${c.id}`" class="card relative z-10 group cursor-pointer">
            <div class="relative z-10 flex gap-4 p-4">
              <!-- Thumbnail -->
              <div class="shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <img v-if="c.imageUrl" :src="c.imageUrl" :alt="c.name" class="w-full h-full object-cover" />
                <span v-else class="text-2xl opacity-30">🧙</span>
              </div>
              <!-- Info -->
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-semibold text-white truncate" style="font-family: Manrope, sans-serif">{{ c.name }}</h3>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  <span v-if="c.race" class="text-sm text-zinc-500">{{ c.race }}</span>
                  <span v-if="c.class" class="text-sm text-zinc-400">{{ c.class }}</span>
                  <span class="badge bg-[#ef233c]/15 text-[#ef233c]">Lv {{ c.level }}</span>
                  <span v-if="!c.isActive" class="badge bg-zinc-800 text-zinc-500">Inactive</span>
                </div>
                <div class="text-xs text-zinc-600 mt-1">🎮 {{ getOwnerName(c.userId) }}</div>
                <p v-if="c.description" class="text-zinc-500 text-sm mt-1 line-clamp-1">{{ c.description }}</p>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

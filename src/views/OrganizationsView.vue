<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { Organization, Npc } from '../types'

const auth = useAuthStore()

const orgs = ref<Organization[]>([])
const npcs = ref<Npc[]>([])
const loading = ref(true)
const searchQuery = ref('')

// Create form state
const showForm = ref(false)
const form = ref({ name: '', description: '' })
const saving = ref(false)

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    orgs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))
    loading.value = false
  }, (e) => {
    console.error('Failed to load organizations:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name', 'asc')), (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }, (e) => console.error('Failed to load NPCs:', e)))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const filteredOrgs = computed(() => {
  if (!searchQuery.value) return orgs.value
  const q = searchQuery.value.toLowerCase()
  return orgs.value.filter(o =>
    o.name.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)
  )
})

const canManage = computed(() => auth.isDm || auth.isAdmin)

function startCreate() {
  form.value = { name: '', description: '' }
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
}

async function saveOrg() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const newOrg = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      members: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await addDoc(collection(db, 'organizations'), newOrg)
    showForm.value = false
  } catch (e) {
    console.error('Failed to save organization:', e)
    alert('Failed to save. Check permissions.')
  } finally {
    saving.value = false
  }
}

async function deleteOrg(org: Organization) {
  if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return
  try {
    await deleteDoc(doc(db, 'organizations', org.id))
    // Clean up NPC organizationIds references
    const { updateDoc } = await import('firebase/firestore')
    for (const npc of npcs.value) {
      if ((npc.organizationIds || []).includes(org.id)) {
        const newIds = npc.organizationIds.filter(id => id !== org.id)
        await updateDoc(doc(db, 'npcs', npc.id), { organizationIds: newIds })
        npc.organizationIds = newIds
      }
    }
  } catch (e) {
    console.error('Failed to delete organization:', e)
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">🏛️ Organizations</h1>
      <div class="flex items-center gap-3">
        <span class="text-zinc-600 text-sm">{{ filteredOrgs.length }} organizations</span>
        <button v-if="canManage" @click="startCreate" class="btn text-sm">+ New</button>
      </div>
    </div>

    <!-- Search -->
    <input v-model="searchQuery" type="text" placeholder="Search organizations..." class="input w-full max-w-md mb-6" />

    <!-- Create Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="cancelForm" />
          <div class="relative bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-[#ef233c]" style="font-family: Manrope, sans-serif">
                🏛️ New Organization
              </h2>
              <button @click="cancelForm" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-sm font-semibold text-zinc-400">Name</label>
                <input v-model="form.name" class="input w-full" placeholder="Organization name" />
              </div>
              <div>
                <label class="text-sm font-semibold text-zinc-400">Description</label>
                <textarea v-model="form.description" class="input w-full" rows="3" placeholder="Description..." />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
              <button @click="cancelForm" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveOrg" :disabled="saving || !form.name.trim()" class="btn text-sm flex items-center gap-2">
                <span v-if="saving" class="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ saving ? 'Saving...' : 'Create' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading organizations...</div>

    <div v-else-if="filteredOrgs.length === 0 && !showForm" class="card p-10 text-center relative z-10">
      <div class="relative z-10">
        <p class="text-zinc-600">No organizations yet.</p>
        <button v-if="canManage" @click="startCreate" class="btn text-sm mt-3">Create the first one</button>
      </div>
    </div>

    <!-- Org cards — clickable links to detail page -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <RouterLink
        v-for="org in filteredOrgs" :key="org.id"
        :to="'/organizations/' + org.id"
        class="card relative z-10 block group hover:border-white/[0.12] transition-all duration-200"
      >
        <div class="relative z-10 p-5">
          <div class="flex items-start gap-4">
            <!-- Sigil thumbnail -->
            <div v-if="org.imageUrl" class="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-white/10">
              <img :src="org.imageUrl" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-14 h-14 shrink-0 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <span class="text-2xl opacity-40">🏛️</span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-base font-semibold text-white group-hover:text-[#ef233c] transition-colors" style="font-family: Manrope, sans-serif">{{ org.name }}</h3>
                  <span class="text-zinc-600 text-xs">{{ (org.members || []).length }} members</span>
                </div>
                <button
                  v-if="canManage"
                  @click.prevent="deleteOrg(org)"
                  class="text-zinc-700 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100 p-1"
                  title="Delete organization"
                >🗑️</button>
              </div>

              <p v-if="org.description" class="text-sm text-zinc-500 mt-1.5 line-clamp-2">{{ org.description }}</p>
            </div>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'

interface LocationEntry {
  label: string
}

type LocationsConfig = Record<string, LocationEntry>

const locations = ref<LocationsConfig>({})
const loading = ref(true)
const saving = ref(false)
const savedKey = ref<string | null>(null)

// Edit state
const editingKey = ref<string | null>(null)
const editForm = ref({ key: '', label: '' })

// Add state
const adding = ref(false)
const addForm = ref({ key: '', label: '' })

let _unsub: (() => void) | null = null

onMounted(() => {
  _unsub = onSnapshot(doc(db, 'config', 'sessionLocations'), (snap) => {
    if (snap.exists()) {
      locations.value = snap.data() as LocationsConfig
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load session locations config:', e)
    loading.value = false
  })
})

onUnmounted(() => _unsub?.())

const sortedLocations = computed(() => {
  return Object.entries(locations.value)
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

function startEdit(key: string) {
  const entry = locations.value[key]
  if (!entry) return
  editingKey.value = key
  editForm.value = { key, label: entry.label }
}

async function saveEdit() {
  if (!editingKey.value || !editForm.value.label.trim()) return
  saving.value = true
  try {
    const oldKey = editingKey.value
    const newKey = editForm.value.key.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const newLocations = { ...locations.value }
    const entry: LocationEntry = { label: editForm.value.label.trim() }

    if (oldKey !== newKey && newKey) {
      delete newLocations[oldKey]
      newLocations[newKey] = entry
    } else {
      newLocations[oldKey] = entry
    }

    await setDoc(doc(db, 'config', 'sessionLocations'), newLocations)
    savedKey.value = (oldKey !== newKey && newKey) ? newKey : oldKey
    setTimeout(() => savedKey.value = null, 2000)
    editingKey.value = null
  } catch (e) {
    console.error('Failed to save:', e)
    alert('Failed to save.')
  } finally {
    saving.value = false
  }
}

function startAdd() {
  adding.value = true
  addForm.value = { key: '', label: '' }
}

async function addLocation() {
  if (!addForm.value.key.trim() || !addForm.value.label.trim()) return
  const key = addForm.value.key.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  if (locations.value[key]) {
    alert('A location with this key already exists.')
    return
  }

  saving.value = true
  try {
    const newLocations = {
      ...locations.value,
      [key]: { label: addForm.value.label.trim() }
    }
    await setDoc(doc(db, 'config', 'sessionLocations'), newLocations)
    adding.value = false
    savedKey.value = key
    setTimeout(() => savedKey.value = null, 2000)
  } catch (e) {
    console.error('Failed to add:', e)
    alert('Failed to add.')
  } finally {
    saving.value = false
  }
}

async function deleteLocation(key: string) {
  if (!confirm(`Delete location "${locations.value[key]?.label || key}"?`)) return
  saving.value = true
  try {
    const newLocations = { ...locations.value }
    delete newLocations[key]
    await setDoc(doc(db, 'config', 'sessionLocations'), newLocations)
  } catch (e) {
    console.error('Failed to delete:', e)
    alert('Failed to delete.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <p class="text-zinc-500 text-sm mb-4">Manage session locations — where your IRL or online sessions take place.</p>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading config...</div>

    <div v-else>
      <!-- Add button -->
      <div class="flex justify-end mb-3">
        <button @click="startAdd" class="btn !text-xs !py-1.5">+ Add Location</button>
      </div>

      <!-- Add Form -->
      <div v-if="adding" class="card-flat p-4 mb-4 space-y-3">
        <h3 class="label">Add New Location</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input v-model="addForm.key" placeholder="Key (e.g. online-discord)" class="input !font-mono" />
          <input v-model="addForm.label" placeholder="Label (e.g. Online (Discord))" class="input" />
          <button @click="addLocation" :disabled="!addForm.key.trim() || !addForm.label.trim() || saving" class="btn !py-2">Add</button>
        </div>
        <button @click="adding = false" class="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
      </div>

      <!-- Empty state -->
      <div v-if="sortedLocations.length === 0 && !adding" class="text-center py-8">
        <div class="text-3xl mb-2">📍</div>
        <p class="text-zinc-500 text-sm">No session locations configured yet.</p>
        <p class="text-zinc-600 text-xs mt-1">Add locations where your group plays.</p>
      </div>

      <!-- Locations list -->
      <div class="space-y-2">
        <div
          v-for="loc in sortedLocations" :key="loc.key"
          :class="['card-flat p-4 flex items-center justify-between transition-all', savedKey === loc.key ? '!border-green-500/40' : '']"
        >
          <div class="min-w-0">
            <div class="text-sm font-semibold text-zinc-200" style="font-family: Manrope, sans-serif">📍 {{ loc.label }}</div>
            <div class="text-xs text-zinc-600 font-mono">{{ loc.key }}</div>
          </div>
          <div class="flex gap-1.5 shrink-0 ml-4">
            <button @click="startEdit(loc.key)" class="btn-action">✏️ Edit</button>
            <button @click="deleteLocation(loc.key)" class="btn-action !text-red-400/70 hover:!text-red-400 hover:!bg-red-500/15">✕ Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="editingKey" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="editingKey = null" />
          <div class="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-3 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit Location</h3>
              <button @click="editingKey = null" class="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Key (internal identifier)</label>
              <input v-model="editForm.key" class="input w-full !font-mono text-sm" />
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Label (display name)</label>
              <input v-model="editForm.label" class="input w-full" />
            </div>
            <div class="flex justify-end gap-2">
              <button @click="editingKey = null" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="!editForm.label.trim() || saving" class="btn text-sm">Save</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

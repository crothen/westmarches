<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase/config'
import { useImageGen } from '../../composables/useImageGen'

interface TerrainEntry {
  id: number
  color: string
  texture?: string
  scale?: number
}

const terrainConfig = ref<Record<string, TerrainEntry>>({})
const loading = ref(true)
const saving = ref(false)
const savedKey = ref<string | null>(null)

// Edit state
const editingKey = ref<string | null>(null)
const editForm = ref({ name: '', color: '#666666', scale: 1.0 })

// Add state
const showAdd = ref(false)
const addForm = ref({ name: '', color: '#666666', scale: 1.0 })

// AI generation state
const generatingKey = ref<string | null>(null)
const genPrompt = ref('')
const { generating: genBusy, error: genError, generateImage } = useImageGen()

onMounted(async () => {
  try {
    const snap = await getDoc(doc(db, 'config', 'terrain'))
    if (snap.exists()) {
      terrainConfig.value = snap.data() as Record<string, TerrainEntry>
    }
  } catch (e) {
    console.error('Failed to load terrain config:', e)
  } finally {
    loading.value = false
  }
})

const sortedTerrains = computed(() => {
  return Object.entries(terrainConfig.value)
    .map(([name, conf]) => ({ name, ...conf }))
    .sort((a, b) => a.id - b.id)
})

function nextId(): number {
  const ids = Object.values(terrainConfig.value).map(c => c.id)
  return ids.length > 0 ? Math.max(...ids) + 1 : 1
}

function getTextureUrl(texture?: string): string | null {
  if (!texture) return null
  if (texture.startsWith('http')) return texture
  return `/textures/${texture}`
}

function startEdit(name: string) {
  const conf = terrainConfig.value[name]
  if (!conf) return
  editingKey.value = name
  editForm.value = {
    name,
    color: conf.color || '#666666',
    scale: conf.scale || 1.0
  }
}

async function saveEdit() {
  if (!editingKey.value || !editForm.value.name.trim()) return
  saving.value = true
  try {
    const oldKey = editingKey.value
    const newKey = editForm.value.name.trim()
    const conf = { ...terrainConfig.value[oldKey]! }
    conf.color = editForm.value.color
    conf.scale = editForm.value.scale

    const newConfig = { ...terrainConfig.value }
    if (oldKey !== newKey) {
      delete newConfig[oldKey]
    }
    newConfig[newKey] = conf

    await setDoc(doc(db, 'config', 'terrain'), newConfig)
    terrainConfig.value = newConfig
    savedKey.value = newKey
    setTimeout(() => savedKey.value = null, 2000)
    editingKey.value = null
  } catch (e) {
    console.error('Failed to save terrain:', e)
    alert('Failed to save.')
  } finally {
    saving.value = false
  }
}

async function addTerrain() {
  if (!addForm.value.name.trim()) return
  const name = addForm.value.name.trim()
  if (terrainConfig.value[name]) {
    alert('Terrain with this name already exists.')
    return
  }
  saving.value = true
  try {
    const newConf: TerrainEntry = {
      id: nextId(),
      color: addForm.value.color,
      scale: addForm.value.scale
    }
    const newConfig = { ...terrainConfig.value, [name]: newConf }
    await setDoc(doc(db, 'config', 'terrain'), newConfig)
    terrainConfig.value = newConfig
    addForm.value = { name: '', color: '#666666', scale: 1.0 }
    showAdd.value = false
  } catch (e) {
    console.error('Failed to add terrain:', e)
    alert('Failed to add.')
  } finally {
    saving.value = false
  }
}

async function deleteTerrain(name: string) {
  if (!confirm(`Delete terrain "${name}"? This won't affect hexes already using it, but they'll fall back to default.`)) return
  saving.value = true
  try {
    const newConfig = { ...terrainConfig.value }
    delete newConfig[name]
    await setDoc(doc(db, 'config', 'terrain'), newConfig)
    terrainConfig.value = newConfig
  } catch (e) {
    console.error('Failed to delete terrain:', e)
    alert('Failed to delete.')
  } finally {
    saving.value = false
  }
}

function startGenerate(name: string) {
  generatingKey.value = name
  genPrompt.value = `A seamless tileable top-down texture for a fantasy hex map representing "${name}" terrain. Style: painterly, dark fantasy, muted natural colors. Must tile seamlessly. 200x200 pixels.`
}

async function generateTexture() {
  if (!generatingKey.value || !genPrompt.value.trim()) return
  const name = generatingKey.value
  const storagePath = `textures/terrain/${name.toLowerCase().replace(/\s+/g, '-')}`
  const url = await generateImage(genPrompt.value, storagePath)
  if (url) {
    // Update config with new texture URL
    const newConfig = { ...terrainConfig.value }
    newConfig[name] = { ...newConfig[name]!, texture: url }
    try {
      await setDoc(doc(db, 'config', 'terrain'), newConfig)
      terrainConfig.value = newConfig
      savedKey.value = name
      setTimeout(() => savedKey.value = null, 2000)
    } catch (e) {
      console.error('Failed to update texture URL:', e)
    }
    generatingKey.value = null
  }
}

async function uploadTexture(name: string, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  saving.value = true
  try {
    const ext = file.name.split('.').pop() || 'png'
    const fileRef = storageRef(storage, `textures/terrain/${name.toLowerCase().replace(/\s+/g, '-')}.${ext}`)
    await uploadBytes(fileRef, file, { contentType: file.type })
    const url = await getDownloadURL(fileRef)

    const newConfig = { ...terrainConfig.value }
    newConfig[name] = { ...newConfig[name]!, texture: url }
    await setDoc(doc(db, 'config', 'terrain'), newConfig)
    terrainConfig.value = newConfig
    savedKey.value = name
    setTimeout(() => savedKey.value = null, 2000)
  } catch (e) {
    console.error('Failed to upload texture:', e)
    alert('Failed to upload.')
  } finally {
    saving.value = false
  }
}

async function removeTexture(name: string) {
  if (!confirm('Remove this texture? The terrain will use its fallback color.')) return
  saving.value = true
  try {
    const newConfig = { ...terrainConfig.value }
    const { texture, ...rest } = newConfig[name]!
    newConfig[name] = rest as TerrainEntry
    await setDoc(doc(db, 'config', 'terrain'), newConfig)
    terrainConfig.value = newConfig
  } catch (e) {
    console.error('Failed to remove texture:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <p class="text-zinc-500 text-sm">Manage terrain types used on the hex map. Edit colors, textures, and generate new ones with AI.</p>
      <button @click="showAdd = !showAdd" class="btn !text-xs !py-1.5">{{ showAdd ? 'Cancel' : '+ Add Terrain' }}</button>
    </div>

    <!-- Add Form -->
    <div v-if="showAdd" class="card-flat p-4 mb-5 space-y-3">
      <h3 class="label">New Terrain Type</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input v-model="addForm.name" placeholder="Name (e.g. Tundra)" class="input" />
        <div class="flex items-center gap-2">
          <label class="text-xs text-zinc-500 shrink-0">Color</label>
          <input v-model="addForm.color" type="color" class="w-10 h-8 rounded border border-white/10 bg-transparent cursor-pointer" />
          <input v-model="addForm.color" class="input flex-1 !font-mono text-xs" placeholder="#666666" />
        </div>
        <button @click="addTerrain" :disabled="!addForm.name.trim() || saving" class="btn !py-2">Add</button>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading terrain config...</div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      <div
        v-for="terrain in sortedTerrains" :key="terrain.name"
        :class="['card-flat overflow-hidden transition-all', savedKey === terrain.name ? '!border-green-500/40' : '']"
      >
        <!-- Texture/Color preview -->
        <div class="h-24 relative" :style="{ backgroundColor: terrain.color || '#333' }">
          <img
            v-if="getTextureUrl(terrain.texture)"
            :src="getTextureUrl(terrain.texture)!"
            class="w-full h-full object-cover"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <div class="absolute top-1 right-1 bg-black/60 text-zinc-400 text-[0.55rem] px-1.5 py-0.5 rounded-full font-mono">
            ID: {{ terrain.id }}
          </div>
          <div v-if="savedKey === terrain.name" class="absolute top-1 left-1 bg-green-500/80 text-white text-[0.55rem] px-1.5 py-0.5 rounded-full">
            ✓ Saved
          </div>
        </div>

        <!-- Info -->
        <div class="p-3">
          <div class="flex items-center justify-between mb-1">
            <h4 class="text-sm font-semibold text-zinc-200" style="font-family: Manrope, sans-serif">{{ terrain.name }}</h4>
            <div class="w-4 h-4 rounded-full border border-white/20 shrink-0" :style="{ backgroundColor: terrain.color }"></div>
          </div>
          <div class="text-[0.6rem] text-zinc-600 mb-2">
            Scale: {{ terrain.scale || 1.0 }}
            <span v-if="terrain.texture" class="ml-2">· Has texture</span>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-1">
            <button @click="startEdit(terrain.name)" class="text-[0.6rem] text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">✏️ Edit</button>
            <button @click="startGenerate(terrain.name)" class="text-[0.6rem] text-zinc-500 hover:text-purple-400 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">🎨 AI Gen</button>
            <label class="text-[0.6rem] text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
              📤 Upload
              <input type="file" accept="image/*" class="hidden" @change="uploadTexture(terrain.name, $event)" />
            </label>
            <button v-if="terrain.texture" @click="removeTexture(terrain.name)" class="text-[0.6rem] text-zinc-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">🗑️</button>
            <button @click="deleteTerrain(terrain.name)" class="text-[0.6rem] text-zinc-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">✕ Del</button>
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
              <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit Terrain</h3>
              <button @click="editingKey = null" class="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Name</label>
              <input v-model="editForm.name" class="input w-full" />
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Color</label>
              <div class="flex items-center gap-2">
                <input v-model="editForm.color" type="color" class="w-12 h-9 rounded border border-white/10 bg-transparent cursor-pointer" />
                <input v-model="editForm.color" class="input flex-1 !font-mono text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Texture Scale ({{ editForm.scale.toFixed(2) }})</label>
              <input v-model.number="editForm.scale" type="range" min="0.1" max="3.0" step="0.05" class="w-full accent-[#ef233c]" />
            </div>
            <div class="flex justify-end gap-2">
              <button @click="editingKey = null" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="!editForm.name.trim() || saving" class="btn text-sm">Save</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- AI Generate Modal -->
    <Teleport to="body">
      <transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="generatingKey" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="!genBusy && (generatingKey = null)" />
          <div class="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-3 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">🎨 Generate Texture — {{ generatingKey }}</h3>
              <button v-if="!genBusy" @click="generatingKey = null" class="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>

            <!-- Current texture preview -->
            <div v-if="terrainConfig[generatingKey!]?.texture" class="flex items-center gap-3">
              <span class="text-xs text-zinc-500">Current:</span>
              <img :src="getTextureUrl(terrainConfig[generatingKey!]!.texture)!" class="w-16 h-16 rounded border border-white/10 object-cover" />
            </div>

            <div>
              <label class="block text-xs text-zinc-500 mb-1">Prompt</label>
              <textarea v-model="genPrompt" class="input w-full text-sm" rows="4" :disabled="genBusy" />
            </div>

            <div v-if="genError" class="text-red-400 text-xs">{{ genError }}</div>

            <div v-if="genBusy" class="flex items-center gap-2 text-zinc-400 text-sm">
              <span class="animate-spin">⏳</span> Generating texture...
            </div>

            <div class="flex justify-end gap-2">
              <button v-if="!genBusy" @click="generatingKey = null" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="generateTexture" :disabled="genBusy || !genPrompt.trim()" class="btn text-sm">
                {{ genBusy ? 'Generating...' : '🎨 Generate' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

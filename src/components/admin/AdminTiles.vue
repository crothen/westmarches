<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
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

// Edit/Add modal state (unified)
const editingKey = ref<string | null>(null)  // null = adding new
const isAdding = ref(false)
const editForm = ref({ name: '', color: '#666666' })

// AI generation state
const generatingKey = ref<string | null>(null)
const genPrompt = ref('')
const { generating: genBusy, error: genError, generateImage } = useImageGen()

// Hex preview canvas
const hexPreviewRef = ref<HTMLCanvasElement | null>(null)

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
  isAdding.value = false
  editingKey.value = name
  editForm.value = { name, color: conf.color || '#666666' }
  nextTick(drawHexPreview)
}

function startAdd() {
  isAdding.value = true
  editingKey.value = '__new__'
  editForm.value = { name: '', color: '#666666' }
}

function closeEdit() {
  editingKey.value = null
  isAdding.value = false
}

// Get the texture URL for the terrain currently being edited
const editingTextureUrl = computed(() => {
  if (isAdding.value || !editingKey.value) return null
  const conf = terrainConfig.value[editingKey.value]
  return conf?.texture ? getTextureUrl(conf.texture) : null
})

function drawHexPreview() {
  const canvas = hexPreviewRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = 2
  const w = 280
  const h = 120
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const hexSize = 35
  const hexes = [
    { x: w / 2, y: h / 2 },
    { x: w / 2 - hexSize * 1.5, y: h / 2 - hexSize * 0.866 },
    { x: w / 2 + hexSize * 1.5, y: h / 2 - hexSize * 0.866 },
  ]

  const textureUrl = editingTextureUrl.value
  if (textureUrl) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      drawHexes(ctx, hexes, hexSize, editForm.value.color, img)
    }
    img.onerror = () => {
      drawHexes(ctx, hexes, hexSize, editForm.value.color, null)
    }
    img.src = textureUrl
  } else {
    drawHexes(ctx, hexes, hexSize, editForm.value.color, null)
  }
}

function drawHexes(ctx: CanvasRenderingContext2D, hexes: { x: number; y: number }[], size: number, color: string, img: HTMLImageElement | null) {
  const angle = (2 * Math.PI) / 6
  for (const hex of hexes) {
    // Define hex path
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(hex.x + size * Math.cos(angle * i), hex.y + size * Math.sin(angle * i))
    }
    ctx.closePath()

    if (img) {
      // Clip to hex shape and draw full image fitted inside
      ctx.save()
      ctx.clip()
      // Draw image to cover the hex bounding box
      const drawSize = size * 2
      ctx.drawImage(img, hex.x - drawSize / 2, hex.y - drawSize / 2, drawSize, drawSize)
      ctx.restore()
      // Re-draw hex border (clip consumed the path)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(hex.x + size * Math.cos(angle * i), hex.y + size * Math.sin(angle * i))
      }
      ctx.closePath()
    } else {
      ctx.fillStyle = color
      ctx.fill()
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

async function saveEdit() {
  if (!editForm.value.name.trim()) return

  if (isAdding.value) {
    // Adding new
    const name = editForm.value.name.trim()
    if (terrainConfig.value[name]) {
      alert('Terrain with this name already exists.')
      return
    }
    saving.value = true
    try {
      const newConf: TerrainEntry = { id: nextId(), color: editForm.value.color }
      const newConfig = { ...terrainConfig.value, [name]: newConf }
      await setDoc(doc(db, 'config', 'terrain'), newConfig)
      terrainConfig.value = newConfig
      savedKey.value = name
      setTimeout(() => savedKey.value = null, 2000)
      closeEdit()
    } catch (e) {
      console.error('Failed to add terrain:', e)
      alert('Failed to add.')
    } finally {
      saving.value = false
    }
  } else {
    // Editing existing
    if (!editingKey.value) return
    saving.value = true
    try {
      const oldKey = editingKey.value
      const newKey = editForm.value.name.trim()
      const conf = { ...terrainConfig.value[oldKey]! }
      conf.color = editForm.value.color

      const newConfig = { ...terrainConfig.value }
      if (oldKey !== newKey) delete newConfig[oldKey]
      newConfig[newKey] = conf

      await setDoc(doc(db, 'config', 'terrain'), newConfig)
      terrainConfig.value = newConfig
      savedKey.value = newKey
      setTimeout(() => savedKey.value = null, 2000)
      closeEdit()
    } catch (e) {
      console.error('Failed to save terrain:', e)
      alert('Failed to save.')
    } finally {
      saving.value = false
    }
  }
}

async function deleteTerrain(name: string) {
  if (!confirm(`Delete terrain "${name}"? Hexes using it will fall back to default.`)) return
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
  const conf = terrainConfig.value[name]
  const color = conf?.color || '#666666'
  genPrompt.value = `Flat seamless ${name.toLowerCase()} surface texture. Color: ${color}. Subtle variation, uniform coverage, no focal point, no center composition. Painterly style, simple, minimal detail. No objects, no features, no borders, no text. The texture should look the same in every corner.`
}

async function generateTexture() {
  if (!generatingKey.value || !genPrompt.value.trim()) return
  const name = generatingKey.value
  const storagePath = `textures/terrain/${name.toLowerCase().replace(/\s+/g, '-')}`
  const url = await generateImage(genPrompt.value, storagePath)
  if (url) {
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
      <button @click="startAdd" class="btn !text-xs !py-1.5">+ Add Terrain</button>
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
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-semibold text-zinc-200" style="font-family: Manrope, sans-serif">{{ terrain.name }}</h4>
            <div class="w-4 h-4 rounded-full border border-white/20 shrink-0" :style="{ backgroundColor: terrain.color }"></div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-1.5">
            <button @click="startEdit(terrain.name)" class="btn-action">✏️ Edit</button>
            <button @click="startGenerate(terrain.name)" class="btn-action !text-purple-400 hover:!bg-purple-500/15">🎨 AI Gen</button>
            <label class="btn-action cursor-pointer">
              📤 Upload
              <input type="file" accept="image/*" class="hidden" @change="uploadTexture(terrain.name, $event)" />
            </label>
            <button v-if="terrain.texture" @click="removeTexture(terrain.name)" class="btn-action !text-red-400/70 hover:!text-red-400 hover:!bg-red-500/15">🗑️ Texture</button>
            <button @click="deleteTerrain(terrain.name)" class="btn-action !text-red-400/70 hover:!text-red-400 hover:!bg-red-500/15">✕ Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit / Add Modal -->
    <Teleport to="body">
      <transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="editingKey" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="closeEdit" />
          <div class="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">{{ isAdding ? '🗺️ New Terrain' : '✏️ Edit Terrain' }}</h3>
              <button @click="closeEdit" class="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>

            <!-- Hex preview (edit mode only, when texture exists) -->
            <div v-if="!isAdding && editingTextureUrl" class="flex flex-col items-center">
              <label class="block text-xs text-zinc-600 mb-1.5 self-start">Preview</label>
              <div class="bg-zinc-950 rounded-lg border border-white/[0.06] p-2">
                <canvas ref="hexPreviewRef" class="block" style="width: 280px; height: 120px" />
              </div>
            </div>

            <!-- Color-only preview for new or textureless terrains -->
            <div v-else class="flex flex-col items-center">
              <label class="block text-xs text-zinc-600 mb-1.5 self-start">Color Preview</label>
              <div class="w-full h-16 rounded-lg border border-white/[0.06]" :style="{ backgroundColor: editForm.color }"></div>
            </div>

            <div>
              <label class="block text-xs text-zinc-500 mb-1">Name</label>
              <input v-model="editForm.name" class="input w-full" :placeholder="isAdding ? 'e.g. Tundra' : ''" />
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Fallback Color</label>
              <div class="flex items-center gap-2">
                <input v-model="editForm.color" type="color" class="w-12 h-9 rounded border border-white/10 bg-transparent cursor-pointer" />
                <input v-model="editForm.color" class="input flex-1 !font-mono text-sm" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-1">
              <button @click="closeEdit" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="!editForm.name.trim() || saving" class="btn text-sm">{{ isAdding ? 'Create' : 'Save' }}</button>
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

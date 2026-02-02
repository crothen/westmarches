<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase/config'
import { locationTypeIcons, featureTypeIcons, markerTypeIcons } from '../../lib/icons'

interface TypeEntry {
  label: string
  iconUrl: string
}

interface MarkerTypesConfig {
  locationTypes: Record<string, TypeEntry>
  featureTypes: Record<string, TypeEntry>
  hexMarkerTypes: Record<string, TypeEntry>
}

// Build defaults from current hardcoded icons
function buildDefaults(): MarkerTypesConfig {
  const locationTypes: Record<string, TypeEntry> = {}
  for (const [key, path] of Object.entries(locationTypeIcons)) {
    locationTypes[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), iconUrl: path }
  }

  const featureTypes: Record<string, TypeEntry> = {}
  for (const [key, path] of Object.entries(featureTypeIcons)) {
    featureTypes[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), iconUrl: path }
  }

  const hexMarkerTypes: Record<string, TypeEntry> = {}
  for (const [key, path] of Object.entries(markerTypeIcons)) {
    hexMarkerTypes[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), iconUrl: path }
  }

  return { locationTypes, featureTypes, hexMarkerTypes }
}

const config = ref<MarkerTypesConfig>(buildDefaults())
const loading = ref(true)
const saving = ref(false)
const savedSection = ref<string | null>(null)

// Edit state
const editingSection = ref<'locationTypes' | 'featureTypes' | 'hexMarkerTypes' | null>(null)
const editingKey = ref<string | null>(null)
const editForm = ref({ label: '', key: '' })

// Add state
const addingSection = ref<'locationTypes' | 'featureTypes' | 'hexMarkerTypes' | null>(null)
const addForm = ref({ key: '', label: '' })

// Active tab within marker management
const activeCategory = ref<'locationTypes' | 'featureTypes' | 'hexMarkerTypes'>('locationTypes')

const categoryLabels: Record<string, string> = {
  locationTypes: '📍 Location Types',
  featureTypes: '📌 Feature Types',
  hexMarkerTypes: '📍 Pin Types'
}

const categoryDescriptions: Record<string, string> = {
  locationTypes: 'Icons shown on the hex map for cities, towns, etc.',
  featureTypes: 'Icons for points of interest within locations.',
  hexMarkerTypes: 'Pins that players and DMs place on hex maps and city maps — clues, battles, waypoints, etc.'
}

let _unsub: (() => void) | null = null

onMounted(() => {
  const defaults = buildDefaults()
  _unsub = onSnapshot(doc(db, 'config', 'markerTypes'), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as MarkerTypesConfig
      config.value = {
        locationTypes: { ...defaults.locationTypes, ...data.locationTypes },
        featureTypes: { ...defaults.featureTypes, ...data.featureTypes },
        hexMarkerTypes: { ...defaults.hexMarkerTypes, ...data.hexMarkerTypes }
      }
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load marker types config:', e)
    loading.value = false
  })
})

onUnmounted(() => _unsub?.())

const currentTypes = computed(() => {
  return Object.entries(config.value[activeCategory.value] || {})
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

// Detect duplicate icon URLs across ALL categories
const duplicateIcons = computed(() => {
  const urlToKeys: Record<string, { section: string; key: string; label: string }[]> = {}
  for (const section of ['locationTypes', 'featureTypes', 'hexMarkerTypes'] as const) {
    for (const [key, entry] of Object.entries(config.value[section] || {})) {
      const url = entry.iconUrl || ''
      if (!url) continue
      if (!urlToKeys[url]) urlToKeys[url] = []
      urlToKeys[url]!.push({ section, key, label: entry.label })
    }
  }
  // Only keep URLs that appear more than once
  const dupes: Record<string, { section: string; key: string; label: string }[]> = {}
  for (const [url, entries] of Object.entries(urlToKeys)) {
    if (entries.length > 1) dupes[url] = entries
  }
  return dupes
})

function isDuplicate(key: string): boolean {
  const entry = config.value[activeCategory.value]?.[key]
  if (!entry?.iconUrl) return false
  return !!duplicateIcons.value[entry.iconUrl]
}

function getDuplicateInfo(key: string): string {
  const entry = config.value[activeCategory.value]?.[key]
  if (!entry?.iconUrl) return ''
  const dupes = duplicateIcons.value[entry.iconUrl]
  if (!dupes) return ''
  const others = dupes.filter(d => !(d.section === activeCategory.value && d.key === key))
  return others.map(d => `${d.label} (${categoryLabels[d.section]?.replace(/^[^ ]+ /, '') || d.section})`).join(', ')
}

function getIconUrl(url: string): string {
  if (!url) return '/icons/locations/other.png'
  return url
}

function startEdit(section: typeof activeCategory.value, key: string) {
  const entry = config.value[section][key]
  if (!entry) return
  editingSection.value = section
  editingKey.value = key
  editForm.value = { label: entry.label, key }
}

async function saveEdit() {
  if (!editingSection.value || !editingKey.value || !editForm.value.label.trim()) return
  saving.value = true
  try {
    const section = editingSection.value
    const oldKey = editingKey.value
    const newKey = editForm.value.key.trim().toLowerCase().replace(/\s+/g, '_')
    const entry = { ...config.value[section][oldKey]!, label: editForm.value.label.trim() }

    const newSection = { ...config.value[section] }
    if (oldKey !== newKey && newKey) {
      delete newSection[oldKey]
      newSection[newKey] = entry
    } else {
      newSection[oldKey] = entry
    }

    const newConfig = { ...config.value, [section]: newSection }
    await setDoc(doc(db, 'config', 'markerTypes'), newConfig)
    config.value = newConfig
    savedSection.value = (oldKey !== newKey && newKey) ? newKey : oldKey
    setTimeout(() => savedSection.value = null, 2000)
    editingSection.value = null
    editingKey.value = null
  } catch (e) {
    console.error('Failed to save:', e)
    alert('Failed to save.')
  } finally {
    saving.value = false
  }
}

function startAdd() {
  addingSection.value = activeCategory.value
  addForm.value = { key: '', label: '' }
}

async function addType() {
  if (!addingSection.value || !addForm.value.key.trim() || !addForm.value.label.trim()) return
  const key = addForm.value.key.trim().toLowerCase().replace(/\s+/g, '_')
  const section = addingSection.value

  if (config.value[section][key]) {
    alert('A type with this key already exists.')
    return
  }

  saving.value = true
  try {
    // Default icon based on category
    const defaultIcons: Record<string, string> = {
      locationTypes: '/icons/locations/other.png',
      featureTypes: '/icons/features/other.png',
      hexMarkerTypes: '/icons/markers/waypoint.png'
    }

    const newSection = {
      ...config.value[section],
      [key]: { label: addForm.value.label.trim(), iconUrl: defaultIcons[section]! }
    }
    const newConfig = { ...config.value, [section]: newSection }
    await setDoc(doc(db, 'config', 'markerTypes'), newConfig)
    config.value = newConfig
    addingSection.value = null
    savedSection.value = key
    setTimeout(() => savedSection.value = null, 2000)
  } catch (e) {
    console.error('Failed to add type:', e)
    alert('Failed to add.')
  } finally {
    saving.value = false
  }
}

async function deleteType(key: string) {
  if (!confirm(`Delete type "${key}"? Existing items using this type won't be affected but will show a fallback icon.`)) return
  saving.value = true
  try {
    const section = activeCategory.value
    const newSection = { ...config.value[section] }
    delete newSection[key]
    const newConfig = { ...config.value, [section]: newSection }
    await setDoc(doc(db, 'config', 'markerTypes'), newConfig)
    config.value = newConfig
  } catch (e) {
    console.error('Failed to delete:', e)
    alert('Failed to delete.')
  } finally {
    saving.value = false
  }
}

async function uploadIcon(key: string, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  saving.value = true
  try {
    const section = activeCategory.value
    const fileRef = storageRef(storage, `icons/${file.name}`)

    // Check if a file with this name already exists in Storage
    let existingUrl: string | null = null
    try {
      existingUrl = await getDownloadURL(fileRef)
    } catch { /* doesn't exist — good */ }

    if (existingUrl) {
      // File already exists — just assign the existing URL, don't re-upload
      const newSection = { ...config.value[section] }
      newSection[key] = { ...newSection[key]!, iconUrl: existingUrl }
      const newConfig = { ...config.value, [section]: newSection }
      await setDoc(doc(db, 'config', 'markerTypes'), newConfig)
      config.value = newConfig
      savedSection.value = key
      setTimeout(() => savedSection.value = null, 2000)
      saving.value = false
      return
    }

    await uploadBytes(fileRef, file, { contentType: file.type })
    const url = await getDownloadURL(fileRef)

    const newSection = { ...config.value[section] }
    newSection[key] = { ...newSection[key]!, iconUrl: url }
    const newConfig = { ...config.value, [section]: newSection }
    await setDoc(doc(db, 'config', 'markerTypes'), newConfig)
    config.value = newConfig
    savedSection.value = key
    setTimeout(() => savedSection.value = null, 2000)
  } catch (e) {
    console.error('Failed to upload icon:', e)
    alert('Failed to upload.')
  } finally {
    saving.value = false
  }
}

const migrating = ref(false)
const migrateProgress = ref('')

async function migrateToStorage() {
  if (!confirm('Upload all local icons to Firebase Storage and update config? This is a one-time migration.')) return
  migrating.value = true
  migrateProgress.value = 'Starting...'
  
  try {
    // Collect all local icon paths from all categories
    const allPaths: { category: string; key: string; localPath: string }[] = []
    
    const categories = [
      { name: 'locationTypes', icons: locationTypeIcons, folder: 'locations' },
      { name: 'featureTypes', icons: featureTypeIcons, folder: 'features' },
      { name: 'hexMarkerTypes', icons: markerTypeIcons, folder: 'markers' }
    ] as const

    for (const cat of categories) {
      for (const [key, path] of Object.entries(cat.icons)) {
        // Only migrate local paths (not already storage URLs)
        if (path.startsWith('http')) continue
        allPaths.push({ category: cat.name, key, localPath: path })
      }
    }

    // Also check current Firestore config for any remaining local paths
    for (const cat of categories) {
      const section = config.value[cat.name as keyof MarkerTypesConfig] || {}
      for (const [key, entry] of Object.entries(section)) {
        if (entry.iconUrl && !entry.iconUrl.startsWith('http')) {
          if (!allPaths.find(p => p.category === cat.name && p.key === key)) {
            allPaths.push({ category: cat.name, key, localPath: entry.iconUrl })
          }
        }
      }
    }

    // Deduplicate by local path (same file should produce same storage URL)
    const pathToUrl: Record<string, string> = {}
    const uniquePaths = [...new Set(allPaths.map(p => p.localPath))]
    
    let uploaded = 0
    for (const localPath of uniquePaths) {
      migrateProgress.value = `Uploading ${++uploaded}/${uniquePaths.length}: ${localPath}`
      
      // Fetch the local file
      const response = await fetch(localPath)
      if (!response.ok) {
        console.warn(`Failed to fetch ${localPath}`)
        continue
      }
      const blob = await response.blob()
      
      // Upload to storage under icons/ using just the filename (no subfolder prefix)
      // so identical files across categories share one URL → duplicate detection works
      const fileName = localPath.split('/').pop() || localPath
      const fileRef = storageRef(storage, `icons/${fileName}`)
      const { ref: uploadedRef } = await (await import('firebase/storage')).uploadBytes(fileRef, blob, { contentType: 'image/png' })
      const url = await (await import('firebase/storage')).getDownloadURL(uploadedRef)
      pathToUrl[localPath] = url
    }

    // Update config with storage URLs
    migrateProgress.value = 'Updating Firestore config...'
    const newConfig = { ...config.value }
    
    for (const item of allPaths) {
      const section = newConfig[item.category as keyof MarkerTypesConfig]
      if (section && section[item.key] && pathToUrl[item.localPath]) {
        section[item.key] = { ...section[item.key]!, iconUrl: pathToUrl[item.localPath]! }
      }
    }

    await setDoc(doc(db, 'config', 'markerTypes'), newConfig)
    config.value = newConfig
    migrateProgress.value = `Done! Migrated ${uploaded} icons.`
    setTimeout(() => { migrateProgress.value = '' }, 5000)
  } catch (e) {
    console.error('Migration failed:', e)
    migrateProgress.value = `Error: ${e}`
  } finally {
    migrating.value = false
  }
}

async function seedDefaults() {
  if (!confirm('This will reset all marker types to their defaults. Custom labels and icons will be lost. Continue?')) return
  saving.value = true
  try {
    const defaults = buildDefaults()
    await setDoc(doc(db, 'config', 'markerTypes'), defaults)
    config.value = defaults
  } catch (e) {
    console.error('Failed to seed:', e)
    alert('Failed to seed defaults.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <p class="text-zinc-500 text-sm">Manage marker types — edit labels, upload custom icons, add or remove types.</p>
      <div class="flex items-center gap-3">
        <button @click="migrateToStorage" :disabled="migrating" class="text-[0.6rem] text-zinc-600 hover:text-[#ef233c] transition-colors">📤 Migrate to Storage</button>
        <button @click="seedDefaults" class="text-[0.6rem] text-zinc-600 hover:text-amber-400 transition-colors">🔄 Reset to defaults</button>
      </div>
    </div>
    <div v-if="migrateProgress" class="mb-3 text-xs text-zinc-400 bg-white/[0.03] rounded-lg p-2 border border-white/[0.06]">
      <span v-if="migrating" class="animate-pulse">⏳</span> {{ migrateProgress }}
    </div>

    <!-- Category Tabs -->
    <div class="flex gap-1 mb-5 border-b border-white/[0.06] pb-px">
      <button
        v-for="cat in (['locationTypes', 'featureTypes', 'hexMarkerTypes'] as const)" :key="cat"
        @click="activeCategory = cat"
        :class="[
          'text-sm px-4 py-2 rounded-t-lg transition-colors relative',
          activeCategory === cat
            ? 'text-white bg-white/[0.04] border border-white/[0.06] border-b-transparent -mb-px'
            : 'text-zinc-600 hover:text-zinc-400'
        ]"
      >
        {{ categoryLabels[cat] }}
      </button>
    </div>

    <p class="text-zinc-600 text-xs mb-4">{{ categoryDescriptions[activeCategory] }}</p>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading config...</div>

    <div v-else>
      <!-- Add button -->
      <div class="flex justify-end mb-3">
        <button @click="startAdd" class="btn !text-xs !py-1.5">+ Add Type</button>
      </div>

      <!-- Add Form -->
      <div v-if="addingSection" class="card-flat p-4 mb-4 space-y-3">
        <h3 class="label">Add New Type</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input v-model="addForm.key" placeholder="Key (e.g. harbor)" class="input !font-mono" />
          <input v-model="addForm.label" placeholder="Label (e.g. Harbor)" class="input" />
          <button @click="addType" :disabled="!addForm.key.trim() || !addForm.label.trim() || saving" class="btn !py-2">Add</button>
        </div>
        <button @click="addingSection = null" class="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
      </div>

      <!-- Type Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div
          v-for="t in currentTypes" :key="t.key"
          :class="['card-flat p-4 transition-all', savedSection === t.key ? '!border-green-500/40' : '']"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="relative shrink-0">
              <img :src="getIconUrl(t.iconUrl)" class="w-10 h-10 object-contain" :alt="t.key" />
              <span v-if="isDuplicate(t.key)" class="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[0.6rem] font-bold rounded-full flex items-center justify-center" :title="'Duplicate icon — also used by: ' + getDuplicateInfo(t.key)">!</span>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-zinc-200 truncate" style="font-family: Manrope, sans-serif">{{ t.label }}</div>
              <div class="text-xs text-zinc-600 font-mono">{{ t.key }}</div>
              <div v-if="isDuplicate(t.key)" class="text-[0.6rem] text-amber-400/80 mt-0.5 truncate">⚠️ Same icon as: {{ getDuplicateInfo(t.key) }}</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5 mt-1">
            <button @click="startEdit(activeCategory, t.key)" class="btn-action">✏️ Edit</button>
            <label class="btn-action cursor-pointer">
              📤 Upload Icon
              <input type="file" accept="image/png,image/webp,image/svg+xml" class="hidden" @change="uploadIcon(t.key, $event)" />
            </label>
            <button @click="deleteType(t.key)" class="btn-action !text-red-400/70 hover:!text-red-400 hover:!bg-red-500/15">✕ Delete</button>
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
              <h3 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit Type</h3>
              <button @click="editingKey = null" class="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            <div class="flex items-center gap-3 mb-2">
              <img :src="getIconUrl(config[editingSection!]?.[editingKey]?.iconUrl || '')" class="w-10 h-10 object-contain" />
              <span class="text-zinc-600 font-mono text-xs">{{ editingKey }}</span>
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

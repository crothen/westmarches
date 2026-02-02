<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useImageGen } from '../../composables/useImageGen'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../firebase/config'
import MentionTextarea from '../common/MentionTextarea.vue'
import type { SessionEntry, SessionEntryType, SessionParticipant, Character, Npc, CampaignLocation, LocationFeature } from '../../types'

const props = defineProps<{
  entry?: SessionEntry | null
  sessionParticipants?: SessionParticipant[]
  entryId?: string // for image upload path
}>()

const emit = defineEmits<{
  submit: [data: Partial<SessionEntry>]
  cancel: []
}>()

const { generating: genLoading, error: genError, generateImage } = useImageGen()

const entryTypes: { key: SessionEntryType; label: string; icon: string }[] = [
  { key: 'interaction', label: 'Interaction', icon: '🤝' },
  { key: 'task', label: 'Task', icon: '✅' },
  { key: 'encounter', label: 'Encounter', icon: '⚔️' },
  { key: 'discovery', label: 'Discovery', icon: '🔍' },
  { key: 'travel', label: 'Travel', icon: '🚶' },
  { key: 'rest', label: 'Rest', icon: '🏕️' },
  { key: 'custom', label: 'Custom', icon: '📝' },
]

// Form state
const type = ref<SessionEntryType>('custom')
const title = ref('')
const description = ref('')
const allParticipantsPresent = ref(true)
const selectedParticipants = ref<SessionParticipant[]>([])
const selectedNpcIds = ref<string[]>([])
const linkedLocationIds = ref<string[]>([])
const linkedFeatureIds = ref<string[]>([])
const imageUrl = ref<string | null>(null)
const showImagePrompt = ref(false)
const imagePrompt = ref('')
const uploadingImage = ref(false)

// Lookup data
const npcs = ref<Npc[]>([])
const locations = ref<CampaignLocation[]>([])
const features = ref<LocationFeature[]>([])
const characters = ref<Character[]>([])

// Participant custom selection toggle
const showParticipants = ref(false)

// Search
const npcSearch = ref('')
const locationSearch = ref('')
const featureSearch = ref('')
const charSearch = ref('')

const _unsubs: (() => void)[] = []

// Pre-fill form when editing
watch(() => props.entry, (e) => {
  if (e) {
    type.value = e.type
    title.value = e.title
    description.value = e.description
    allParticipantsPresent.value = e.allParticipantsPresent !== false
    selectedParticipants.value = [...(e.presentParticipants || [])]
    selectedNpcIds.value = [...(e.npcIds || [])]
    linkedLocationIds.value = [...(e.linkedLocationIds || [])]
    linkedFeatureIds.value = [...(e.linkedFeatureIds || [])]
    imageUrl.value = e.imageUrl || null
    if (!e.allParticipantsPresent && e.presentParticipants?.length) showParticipants.value = true
  }
}, { immediate: true })

onMounted(() => {
  // Load NPCs
  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name')), (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }))
  // Load locations
  _unsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name')), (snap) => {
    locations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
  }))
  // Load features
  _unsubs.push(onSnapshot(query(collection(db, 'features'), orderBy('name')), (snap) => {
    features.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
  }))
  // Load characters for participant picker
  _unsubs.push(onSnapshot(query(collection(db, 'characters'), orderBy('name')), (snap) => {
    characters.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
  }))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const filteredNpcs = computed(() => {
  const q = npcSearch.value.toLowerCase().trim()
  if (!q) return npcs.value.slice(0, 20)
  return npcs.value.filter(n => n.name.toLowerCase().includes(q))
})

const filteredLocations = computed(() => {
  const q = locationSearch.value.toLowerCase().trim()
  if (!q) return locations.value.slice(0, 20)
  return locations.value.filter(l => l.name.toLowerCase().includes(q))
})

const filteredFeatures = computed(() => {
  const q = featureSearch.value.toLowerCase().trim()
  if (!q) return features.value.slice(0, 20)
  return features.value.filter(f => f.name.toLowerCase().includes(q))
})

const filteredCharacters = computed(() => {
  const q = charSearch.value.toLowerCase().trim()
  // Only show session participants as selectable
  const participantIds = (props.sessionParticipants || []).map(p => p.characterId)
  const eligible = characters.value.filter(c => participantIds.includes(c.id))
  if (!q) return eligible
  return eligible.filter(c => c.name.toLowerCase().includes(q))
})

function isParticipantSelected(charId: string): boolean {
  return selectedParticipants.value.some(p => p.characterId === charId)
}

function toggleParticipant(char: Character) {
  const idx = selectedParticipants.value.findIndex(p => p.characterId === char.id)
  if (idx >= 0) {
    selectedParticipants.value.splice(idx, 1)
  } else {
    selectedParticipants.value.push({
      userId: char.userId || '',
      characterId: char.id,
      characterName: char.name
    })
  }
}

function isNpcSelected(id: string): boolean { return selectedNpcIds.value.includes(id) }
function toggleNpc(id: string) {
  const idx = selectedNpcIds.value.indexOf(id)
  if (idx >= 0) selectedNpcIds.value.splice(idx, 1)
  else selectedNpcIds.value.push(id)
}

function isLocationSelected(id: string): boolean { return linkedLocationIds.value.includes(id) }
function toggleLocation(id: string) {
  const idx = linkedLocationIds.value.indexOf(id)
  if (idx >= 0) linkedLocationIds.value.splice(idx, 1)
  else linkedLocationIds.value.push(id)
}

function isFeatureSelected(id: string): boolean { return linkedFeatureIds.value.includes(id) }
function toggleFeature(id: string) {
  const idx = linkedFeatureIds.value.indexOf(id)
  if (idx >= 0) linkedFeatureIds.value.splice(idx, 1)
  else linkedFeatureIds.value.push(id)
}

const isValid = computed(() => title.value.trim() && type.value)

async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingImage.value = true
  try {
    const path = `session-entries/${props.entryId || crypto.randomUUID()}/${file.name}`
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, file, { contentType: file.type })
    imageUrl.value = await getDownloadURL(fileRef)
  } catch (err) {
    console.error('Image upload failed:', err)
  } finally {
    uploadingImage.value = false
  }
}

function buildDefaultEntryPrompt(): string {
  // Build character appearance descriptions for participants
  const participantChars = allParticipantsPresent.value
    ? (props.sessionParticipants || [])
    : selectedParticipants.value
  const charDescriptions = participantChars.map(p => {
    const char = characters.value.find(c => c.id === p.characterId)
    if (char?.appearance) {
      return `${p.characterName} (${char.race || ''} ${char.class || ''} — ${char.appearance})`.replace(/\(\s+/, '(')
    }
    return p.characterName
  }).filter(Boolean)

  // Build NPC appearance descriptions
  const npcDescriptions = selectedNpcIds.value.map(id => {
    const npc = npcs.value.find(n => n.id === id)
    if (!npc) return null
    if (npc.appearance) return `${npc.name} (${npc.race || ''} — ${npc.appearance})`.replace(/\(\s+/, '(')
    return npc.name
  }).filter(Boolean)

  let prompt = `Fantasy D&D illustration: ${title.value}. ${description.value?.substring(0, 300)}.`
  if (charDescriptions.length) prompt += ` Characters: ${charDescriptions.join('; ')}.`
  if (npcDescriptions.length) prompt += ` NPCs: ${npcDescriptions.join('; ')}.`
  prompt += ` Style: epic fantasy art, dramatic lighting, painterly.`
  return prompt
}

async function generateEntryImage() {
  const prompt = imagePrompt.value || buildDefaultEntryPrompt()
  showImagePrompt.value = false
  const path = `session-entries/${props.entryId || crypto.randomUUID()}/generated`
  const url = await generateImage(prompt, path)
  if (url) imageUrl.value = url
}

function removeImage() {
  imageUrl.value = null
}

function handleSubmit() {
  if (!isValid.value) return
  emit('submit', {
    type: type.value,
    title: title.value.trim(),
    description: description.value.trim(),
    allParticipantsPresent: allParticipantsPresent.value,
    presentParticipants: allParticipantsPresent.value ? [] : selectedParticipants.value,
    npcIds: selectedNpcIds.value,
    linkedLocationIds: linkedLocationIds.value,
    linkedFeatureIds: linkedFeatureIds.value,
    imageUrl: imageUrl.value || undefined,
  })
}

function getNpcName(id: string): string {
  return npcs.value.find(n => n.id === id)?.name || id
}
function getLocationName(id: string): string {
  return locations.value.find(l => l.id === id)?.name || id
}
function getFeatureName(id: string): string {
  return features.value.find(f => f.id === id)?.name || id
}
</script>

<template>
  <div class="card-flat p-4 space-y-4">
    <!-- Type + Title row -->
    <div class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
      <div>
        <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Type</label>
        <select v-model="type" class="input w-full">
          <option v-for="t in entryTypes" :key="t.key" :value="t.key">{{ t.icon }} {{ t.label }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Title</label>
        <input v-model="title" type="text" placeholder="What happened..." class="input w-full" />
      </div>
    </div>

    <!-- Description -->
    <div>
      <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Description</label>
      <MentionTextarea v-model="description" placeholder="Describe this moment... Use @mentions for characters/NPCs" :rows="4" />
    </div>

    <!-- Participants toggle -->
    <div>
      <div class="flex items-center gap-3">
        <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Present</label>
        <button
          type="button"
          @click="allParticipantsPresent = !allParticipantsPresent; if (!allParticipantsPresent) showParticipants = true"
          :class="[
            'text-xs px-2.5 py-1 rounded-md border transition-colors',
            allParticipantsPresent
              ? 'bg-[#ef233c]/10 border-[#ef233c]/30 text-[#ef233c]'
              : 'bg-white/5 border-white/10 text-zinc-400'
          ]"
        >
          {{ allParticipantsPresent ? '✓ All participants' : 'Custom selection' }}
        </button>
      </div>
      <div v-if="!allParticipantsPresent && showParticipants" class="mt-2">
        <input v-model="charSearch" type="text" placeholder="Search characters..." class="input w-full text-sm mb-2" />
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
          <button
            v-for="char in filteredCharacters" :key="char.id"
            @click="toggleParticipant(char)"
            type="button"
            :class="[
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition-all border',
              isParticipantSelected(char.id)
                ? 'bg-[#ef233c]/10 border-[#ef233c]/30 text-zinc-100'
                : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/10'
            ]"
          >
            <span :class="isParticipantSelected(char.id) ? 'text-[#ef233c]' : 'text-zinc-600'">{{ isParticipantSelected(char.id) ? '✓' : '○' }}</span>
            <span class="truncate">{{ char.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- NPCs -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">👤 NPCs involved</span>
        <span class="text-xs text-zinc-600">({{ selectedNpcIds.length }})</span>
      </div>
      <!-- Selected chips -->
      <div v-if="selectedNpcIds.length" class="flex flex-wrap gap-1.5 mb-2">
        <span v-for="id in selectedNpcIds" :key="id" class="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
          {{ getNpcName(id) }}
          <button type="button" @click="toggleNpc(id)" class="hover:text-red-400 ml-0.5">✕</button>
        </span>
      </div>
      <input v-model="npcSearch" type="text" placeholder="Search NPCs..." class="input w-full text-sm mb-2" />
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 max-h-32 overflow-y-auto">
        <button
          v-for="npc in filteredNpcs" :key="npc.id"
          @click="toggleNpc(npc.id)"
          type="button"
          :class="[
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-all border',
            isNpcSelected(npc.id)
              ? 'bg-[#ef233c]/10 border-[#ef233c]/30 text-zinc-100'
              : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/10'
          ]"
        >
          <span :class="isNpcSelected(npc.id) ? 'text-[#ef233c]' : 'text-zinc-600'">{{ isNpcSelected(npc.id) ? '✓' : '○' }}</span>
          <span class="truncate">{{ npc.name }}</span>
        </button>
      </div>
    </div>

    <!-- Linked locations / features -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">📍 Linked locations & features</span>
        <span class="text-xs text-zinc-600">({{ linkedLocationIds.length + linkedFeatureIds.length }})</span>
      </div>
      <div class="space-y-3">
        <!-- Selected chips -->
        <div v-if="linkedLocationIds.length || linkedFeatureIds.length" class="flex flex-wrap gap-1.5 mb-2">
          <span v-for="id in linkedLocationIds" :key="'loc-'+id" class="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">
            🏰 {{ getLocationName(id) }}
            <button type="button" @click="toggleLocation(id)" class="hover:text-red-400 ml-0.5">✕</button>
          </span>
          <span v-for="id in linkedFeatureIds" :key="'feat-'+id" class="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-md border border-green-500/20">
            📌 {{ getFeatureName(id) }}
            <button type="button" @click="toggleFeature(id)" class="hover:text-red-400 ml-0.5">✕</button>
          </span>
        </div>
        <!-- Locations -->
        <div>
          <label class="text-xs text-zinc-600 mb-1 block">Locations</label>
          <input v-model="locationSearch" type="text" placeholder="Search locations..." class="input w-full text-sm mb-1.5" />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-28 overflow-y-auto">
            <button
              v-for="loc in filteredLocations" :key="loc.id"
              @click="toggleLocation(loc.id)"
              type="button"
              :class="[
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-all border',
                isLocationSelected(loc.id)
                  ? 'bg-blue-500/10 border-blue-500/30 text-zinc-100'
                  : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/10'
              ]"
            >
              <span>{{ isLocationSelected(loc.id) ? '✓' : '○' }}</span>
              <span class="truncate">{{ loc.name }}</span>
            </button>
          </div>
        </div>
        <!-- Features -->
        <div>
          <label class="text-xs text-zinc-600 mb-1 block">Features / POIs</label>
          <input v-model="featureSearch" type="text" placeholder="Search features..." class="input w-full text-sm mb-1.5" />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-28 overflow-y-auto">
            <button
              v-for="feat in filteredFeatures" :key="feat.id"
              @click="toggleFeature(feat.id)"
              type="button"
              :class="[
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-all border',
                isFeatureSelected(feat.id)
                  ? 'bg-green-500/10 border-green-500/30 text-zinc-100'
                  : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/10'
              ]"
            >
              <span>{{ isFeatureSelected(feat.id) ? '✓' : '○' }}</span>
              <span class="truncate">{{ feat.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Image -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">🎨 Image</span>
        <span v-if="imageUrl" class="text-xs text-green-400">✓ Added</span>
      </div>
      <div class="space-y-2">
        <div v-if="imageUrl" class="relative group">
          <img :src="imageUrl" class="w-full max-h-48 object-cover rounded-lg border border-white/10" />
          <button type="button" @click="removeImage" class="absolute top-2 right-2 bg-black/70 text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">✕ Remove</button>
        </div>
        <div class="flex gap-2 flex-wrap">
          <label class="btn-action cursor-pointer">
            📁 Upload
            <input type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
          </label>
          <button type="button" @click="showImagePrompt = !showImagePrompt" class="btn-action" :disabled="genLoading">
            {{ genLoading ? '🎨 Generating...' : '🎨 Generate' }}
          </button>
        </div>
        <div v-if="uploadingImage" class="text-xs text-zinc-500 animate-pulse">Uploading...</div>
        <div v-if="showImagePrompt" class="space-y-2">
          <textarea v-model="imagePrompt" rows="3" class="input w-full text-sm" :placeholder="`Fantasy illustration: ${title}...`" />
          <div class="flex gap-2">
            <button type="button" @click="generateEntryImage" :disabled="genLoading" class="btn !text-xs !py-1.5">
              {{ genLoading ? 'Generating...' : 'Generate' }}
            </button>
            <button type="button" @click="showImagePrompt = false" class="btn-action">Cancel</button>
          </div>
        </div>
        <div v-if="genError" class="text-red-400 text-xs">{{ genError }}</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
      <button type="button" @click="$emit('cancel')" class="btn-action">Cancel</button>
      <button type="button" @click="handleSubmit" :disabled="!isValid" class="btn !text-xs !py-1.5 !px-4">
        {{ entry ? 'Save Changes' : 'Add Entry' }}
      </button>
    </div>
  </div>
</template>

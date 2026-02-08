<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import TagInput from '../common/TagInput.vue'
import MentionTextarea from '../common/MentionTextarea.vue'
import type { SessionLog, SessionParticipant, Character, Npc, CampaignLocation, LocationFeature } from '../../types'

interface LocationEntry {
  label: string
}

const props = defineProps<{
  /** Existing session data for editing, null for creation */
  session?: SessionLog | null
  /** Next session number for creation mode */
  nextSessionNumber?: number
}>()

const emit = defineEmits<{
  submit: [data: Partial<SessionLog>]
  cancel: []
}>()

// Form state
const sessionNumber = ref(props.nextSessionNumber ?? 1)
const title = ref('')
const date = ref('')
const inGameStartDate = ref('')
const inGameDurationDays = ref<number | undefined>(undefined)
const dmName = ref('')
const sessionLocationId = ref('')
const summary = ref('')
const selectedParticipants = ref<SessionParticipant[]>([])
const selectedNpcIds = ref<string[]>([])
const tags = ref<string[]>([])

// Starting point state
const startingPointType = ref<'location' | 'feature' | ''>('')
const startingPointId = ref('')
const startingPointSearch = ref('')

// Lookup data
const characters = ref<Character[]>([])
const npcs = ref<Npc[]>([])
const campaignLocations = ref<CampaignLocation[]>([])
const campaignFeatures = ref<LocationFeature[]>([])
const sessionLocations = ref<Record<string, LocationEntry>>({})
const loading = ref(true)

const _unsubs: (() => void)[] = []

// Pre-fill form from existing session for editing
watch(() => props.session, (s) => {
  if (s) {
    sessionNumber.value = s.sessionNumber
    title.value = s.title
    const d = (s.date as any)?.toDate ? (s.date as any).toDate() : new Date(s.date)
    date.value = d.toISOString().split('T')[0]!
    inGameStartDate.value = s.inGameStartDate || ''
    inGameDurationDays.value = s.inGameDurationDays || undefined
    dmName.value = s.dmName || ''
    sessionLocationId.value = s.sessionLocationId || ''
    summary.value = s.summary
    selectedParticipants.value = [...(s.participants || [])]
    selectedNpcIds.value = [...(s.npcsEncountered || [])]
    tags.value = [...(s.tags || [])]
    startingPointType.value = s.startingPointType || ''
    startingPointId.value = s.startingPointId || ''
  }
}, { immediate: true })

onMounted(() => {
  // Load characters
  const charsQ = query(collection(db, 'characters'), orderBy('name'))
  _unsubs.push(onSnapshot(charsQ, (snap) => {
    characters.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
  }))

  // Load NPCs
  const npcsQ = query(collection(db, 'npcs'), orderBy('name'))
  _unsubs.push(onSnapshot(npcsQ, (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }))

  // Load campaign locations for starting point picker
  const locsQ = query(collection(db, 'locations'), orderBy('name'))
  _unsubs.push(onSnapshot(locsQ, (snap) => {
    campaignLocations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
  }))

  // Load features for starting point picker
  const featsQ = query(collection(db, 'features'), orderBy('name'))
  _unsubs.push(onSnapshot(featsQ, (snap) => {
    campaignFeatures.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
  }))

  // Load session locations config
  _unsubs.push(onSnapshot(doc(db, 'config', 'sessionLocations'), (snap) => {
    if (snap.exists()) {
      sessionLocations.value = snap.data() as Record<string, LocationEntry>
    }
    loading.value = false
  }, () => {
    loading.value = false
  }))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const sortedLocations = computed(() => {
  return Object.entries(sessionLocations.value)
    .map(([key, entry]) => ({ key, label: entry.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

// Starting point filtered options
const filteredStartingPoints = computed(() => {
  const q = startingPointSearch.value.toLowerCase().trim()
  if (startingPointType.value === 'location') {
    const locs = campaignLocations.value.filter(l => !l.hidden)
    if (!q) return locs.map(l => ({ id: l.id, name: l.name }))
    return locs.filter(l => l.name.toLowerCase().includes(q)).map(l => ({ id: l.id, name: l.name }))
  }
  if (startingPointType.value === 'feature') {
    const feats = campaignFeatures.value.filter(f => !f.hidden)
    if (!q) return feats.map(f => ({ id: f.id, name: f.name }))
    return feats.filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, name: f.name }))
  }
  return []
})

function getStartingPointName(): string {
  if (!startingPointId.value || !startingPointType.value) return ''
  if (startingPointType.value === 'location') {
    return campaignLocations.value.find(l => l.id === startingPointId.value)?.name || ''
  }
  if (startingPointType.value === 'feature') {
    return campaignFeatures.value.find(f => f.id === startingPointId.value)?.name || ''
  }
  return ''
}

const activeCharacters = computed(() => characters.value.filter(c => c.isActive))

function isCharacterSelected(charId: string): boolean {
  return selectedParticipants.value.some(p => p.characterId === charId)
}

function toggleCharacter(char: Character) {
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

function isNpcSelected(npcId: string): boolean {
  return selectedNpcIds.value.includes(npcId)
}

function toggleNpc(npcId: string) {
  const idx = selectedNpcIds.value.indexOf(npcId)
  if (idx >= 0) {
    selectedNpcIds.value.splice(idx, 1)
  } else {
    selectedNpcIds.value.push(npcId)
  }
}

const isValid = computed(() => {
  return sessionNumber.value > 0 && title.value.trim() && date.value
})

function handleSubmit() {
  if (!isValid.value) return

  const locationName = sessionLocationId.value
    ? sessionLocations.value[sessionLocationId.value]?.label || ''
    : ''

  const spName = getStartingPointName()

  const payload: Record<string, any> = {
    sessionNumber: sessionNumber.value,
    title: title.value.trim(),
    date: new Date(date.value + 'T12:00:00'),
    inGameStartDate: inGameStartDate.value || null,
    inGameDurationDays: inGameDurationDays.value || null,
    dmName: dmName.value.trim(),
    summary: summary.value.trim(),
    participants: selectedParticipants.value,
    npcsEncountered: selectedNpcIds.value,
    tags: tags.value,
  }
  if (sessionLocationId.value) {
    payload.sessionLocationId = sessionLocationId.value
    payload.sessionLocationName = locationName || ''
  }
  if (startingPointType.value && startingPointId.value) {
    payload.startingPointType = startingPointType.value as 'location' | 'feature'
    payload.startingPointId = startingPointId.value
    payload.startingPointName = spName || ''
  }
  emit('submit', payload as any)
}

// Character search filter
const charSearch = ref('')
const filteredCharacters = computed(() => {
  const q = charSearch.value.toLowerCase().trim()
  const chars = activeCharacters.value
  if (!q) return chars
  return chars.filter(c => c.name.toLowerCase().includes(q) || c.class.toLowerCase().includes(q) || c.race.toLowerCase().includes(q))
})

// NPC search filter
const npcSearch = ref('')
const filteredNpcs = computed(() => {
  const q = npcSearch.value.toLowerCase().trim()
  if (!q) return npcs.value.slice(0, 30)
  return npcs.value.filter(n => n.name.toLowerCase().includes(q))
})

// Collapsible sections
const showParticipants = ref(true)
const showNpcs = ref(true)
</script>

<template>
  <div class="space-y-5">
    <!-- Row: Session number + Date + DM + Location -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      <div>
        <label class="text-sm font-semibold text-zinc-400">Session #</label>
        <input v-model.number="sessionNumber" type="number" min="1" class="input w-full" />
      </div>
      <div>
        <label class="text-sm font-semibold text-zinc-400">Date</label>
        <input v-model="date" type="date" class="input w-full" @click="($event.target as HTMLInputElement).showPicker?.()" />
      </div>
      <div>
        <label class="text-sm font-semibold text-zinc-400">DM</label>
        <input v-model="dmName" type="text" placeholder="Dungeon Master name" class="input w-full" />
      </div>
      <div>
        <label class="text-sm font-semibold text-zinc-400">Location</label>
        <select v-model="sessionLocationId" class="input w-full">
          <option value="">— Select —</option>
          <option v-for="loc in sortedLocations" :key="loc.key" :value="loc.key">{{ loc.label }}</option>
        </select>
      </div>
    </div>

    <!-- Row: In-game date + duration -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="text-sm font-semibold text-zinc-400">🗓️ In-Game Date</label>
        <input v-model="inGameStartDate" type="date" class="input w-full" @click="($event.target as HTMLInputElement).showPicker?.()" placeholder="When does this session take place in-game?" />
      </div>
      <div>
        <label class="text-sm font-semibold text-zinc-400">⏱️ Duration (days)</label>
        <input v-model.number="inGameDurationDays" type="number" min="1" class="input w-full" placeholder="How many in-game days?" />
      </div>
    </div>

    <!-- Starting Point -->
    <div>
      <label class="text-sm font-semibold text-zinc-400">Starting Point</label>
      <div class="flex gap-2 mt-1">
        <select v-model="startingPointType" class="input !w-auto" @change="startingPointId = ''; startingPointSearch = ''">
          <option value="">— None —</option>
          <option value="location">🏰 Location</option>
          <option value="feature">📌 POI</option>
        </select>
        <div v-if="startingPointType" class="flex-1 relative">
          <input
            v-model="startingPointSearch"
            type="text"
            :placeholder="startingPointType === 'location' ? 'Search locations...' : 'Search POIs...'"
            class="input w-full"
          />
          <!-- Selected indicator -->
          <div v-if="startingPointId && getStartingPointName()" class="mt-1 flex items-center gap-2">
            <span class="text-xs text-zinc-400">✓ {{ getStartingPointName() }}</span>
            <button @click="startingPointId = ''" class="text-zinc-600 hover:text-red-400 text-xs transition-colors" type="button">✕</button>
          </div>
          <!-- Dropdown -->
          <div v-if="startingPointSearch && filteredStartingPoints.length > 0" class="absolute z-30 top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            <button
              v-for="opt in filteredStartingPoints.slice(0, 20)" :key="opt.id"
              @click="startingPointId = opt.id; startingPointSearch = ''"
              :class="['w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors', startingPointId === opt.id ? 'text-[#ef233c]' : 'text-zinc-300']"
              type="button"
            >{{ opt.name }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Title -->
    <div>
      <label class="text-sm font-semibold text-zinc-400">Title</label>
      <input v-model="title" type="text" placeholder="The Siege of Blackthorn..." class="input w-full" />
    </div>

    <!-- Summary -->
    <div>
      <label class="text-sm font-semibold text-zinc-400">Summary</label>
      <MentionTextarea v-model="summary" :rows="5" placeholder="What happened this session... Use @ for characters/NPCs, # for locations/features, ¦ for organizations" />
    </div>

    <!-- Participants -->
    <div>
      <button
        @click="showParticipants = !showParticipants"
        class="flex items-center gap-2 w-full text-left"
      >
        <span class="text-base font-semibold text-zinc-200" style="font-family: Manrope, sans-serif">🧙 Participants</span>
        <span class="text-xs text-zinc-500">({{ selectedParticipants.length }} selected)</span>
        <span class="text-zinc-600 text-xs ml-auto">{{ showParticipants ? '▾' : '▸' }}</span>
      </button>
      <div v-if="showParticipants" class="mt-2">
        <input v-model="charSearch" type="text" placeholder="Search characters..." class="input w-full text-sm mb-2" />
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
          <button
            v-for="char in filteredCharacters" :key="char.id"
            @click="toggleCharacter(char)"
            :class="[
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all border',
              isCharacterSelected(char.id)
                ? 'bg-[#ef233c]/10 border-[#ef233c]/30 text-zinc-100'
                : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/10 hover:text-zinc-200'
            ]"
            type="button"
          >
            <span v-if="isCharacterSelected(char.id)" class="text-[#ef233c]">✓</span>
            <span v-else class="text-zinc-600">○</span>
            <span class="truncate">{{ char.name }}</span>
            <span class="text-xs text-zinc-600 ml-auto shrink-0">{{ char.class }} {{ char.level }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- NPCs -->
    <div>
      <button
        @click="showNpcs = !showNpcs"
        class="flex items-center gap-2 w-full text-left"
      >
        <span class="text-base font-semibold text-zinc-200" style="font-family: Manrope, sans-serif">👤 NPCs Encountered</span>
        <span class="text-xs text-zinc-500">({{ selectedNpcIds.length }} selected)</span>
        <span class="text-zinc-600 text-xs ml-auto">{{ showNpcs ? '▾' : '▸' }}</span>
      </button>
      <div v-if="showNpcs" class="mt-2">
        <input v-model="npcSearch" type="text" placeholder="Search NPCs..." class="input w-full text-sm mb-2" />
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
          <button
            v-for="npc in filteredNpcs" :key="npc.id"
            @click="toggleNpc(npc.id)"
            :class="[
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all border',
              isNpcSelected(npc.id)
                ? 'bg-[#ef233c]/10 border-[#ef233c]/30 text-zinc-100'
                : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/10 hover:text-zinc-200'
            ]"
            type="button"
          >
            <span v-if="isNpcSelected(npc.id)" class="text-[#ef233c]">✓</span>
            <span v-else class="text-zinc-600">○</span>
            <span class="truncate">{{ npc.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Tags -->
    <div>
      <label class="text-sm font-semibold text-zinc-400">Tags</label>
      <TagInput v-model="tags" />
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
      <button @click="$emit('cancel')" class="btn !bg-white/5 !text-zinc-400 text-sm" type="button">Cancel</button>
      <button @click="handleSubmit" :disabled="!isValid" class="btn text-sm" type="button">
        {{ session ? 'Save Changes' : 'Create Session' }}
      </button>
    </div>
  </div>
</template>

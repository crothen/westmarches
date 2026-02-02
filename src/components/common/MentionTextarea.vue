<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../composables/useAuth'
import type { MentionKind } from '../../lib/mentionRenderer'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  rows?: number
  inputClass?: string
}>(), {
  placeholder: '',
  rows: 3,
  inputClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

interface MentionCandidate {
  id: string
  name: string
  kind: MentionKind
  detail?: string
}

type TriggerChar = '@' | '#' | '\u00A6'
const TRIGGER_CHARS = new Set<string>(['@', '#', '\u00A6'])

const auth = useAuth()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showDropdown = ref(false)
const mentionSearch = ref('')
const mentionStartIndex = ref(-1)
const mentionTrigger = ref<TriggerChar | null>(null)
const selectedIndex = ref(0)
const dropdownPos = ref({ top: 0, left: 0 })
const loaded = ref(false)

const _mentionUnsubs: (() => void)[] = []
const charCandidates = ref<MentionCandidate[]>([])
const npcCandidates = ref<MentionCandidate[]>([])
const locationCandidates = ref<MentionCandidate[]>([])
const featureCandidates = ref<MentionCandidate[]>([])
const pinCandidates = ref<MentionCandidate[]>([])
const orgCandidates = ref<MentionCandidate[]>([])

const allCandidates = computed<MentionCandidate[]>(() => [
  ...charCandidates.value,
  ...npcCandidates.value,
  ...locationCandidates.value,
  ...featureCandidates.value,
  ...pinCandidates.value,
  ...orgCandidates.value,
])

function loadCandidates() {
  if (loaded.value) return
  loaded.value = true

  _mentionUnsubs.push(onSnapshot(query(collection(db, 'characters'), orderBy('name', 'asc')), (snap) => {
    charCandidates.value = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, name: data.name, kind: 'char' as const, detail: `${data.race} ${data.class}` }
    })
  }, (e) => console.warn('Failed to load character candidates:', e)))

  _mentionUnsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name', 'asc')), (snap) => {
    npcCandidates.value = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, name: data.name, kind: 'npc' as const, detail: data.race || '' }
    })
  }, (e) => console.warn('Failed to load NPC candidates:', e)))

  _mentionUnsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name', 'asc')), (snap) => {
    locationCandidates.value = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, name: data.name, kind: 'location' as const, detail: data.type || '' }
    })
  }, (e) => console.warn('Failed to load location candidates:', e)))

  _mentionUnsubs.push(onSnapshot(query(collection(db, 'features'), orderBy('name', 'asc')), (snap) => {
    featureCandidates.value = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, name: data.name, kind: 'feature' as const, detail: data.type || '' }
    })
  }, (e) => console.warn('Failed to load feature candidates:', e)))

  _mentionUnsubs.push(onSnapshot(query(collection(db, 'markers'), orderBy('name', 'asc')), (snap) => {
    const currentUid = auth.firebaseUser?.uid
    const isAdmin = auth.isAdmin
    pinCandidates.value = snap.docs
      .filter(d => {
        const data = d.data()
        // Don't show private markers that don't belong to the current user (unless admin)
        if (data.isPrivate && data.createdBy !== currentUid && !isAdmin) return false
        return true
      })
      .map(d => {
        const data = d.data()
        return { id: d.id, name: data.name, kind: 'pin' as const, detail: data.type || '' }
      })
  }, (e) => console.warn('Failed to load marker candidates:', e)))

  _mentionUnsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    orgCandidates.value = snap.docs.map(d => {
      const data = d.data()
      const memberCount = Array.isArray(data.members) ? data.members.length : 0
      return { id: d.id, name: data.name, kind: 'org' as const, detail: memberCount > 0 ? `${memberCount} members` : '' }
    })
  }, (e) => console.warn('Failed to load organization candidates:', e)))
}

/** Group label for a kind */
function kindGroupLabel(kind: MentionKind): string {
  switch (kind) {
    case 'char': return 'Characters'
    case 'npc': return 'NPCs'
    case 'location': return 'Locations'
    case 'feature': return 'Features'
    case 'pin': return 'Pins'
    case 'org': return 'Organizations'
  }
}

/** Emoji icon for a kind */
function kindIcon(kind: MentionKind): string {
  switch (kind) {
    case 'char': return '🧙'
    case 'npc': return '👤'
    case 'location': return '📍'
    case 'feature': return '📌'
    case 'pin': return '🏷️'
    case 'org': return '🏛️'
  }
}

/** CSS classes for a kind badge */
function kindBadgeClass(kind: MentionKind): string {
  switch (kind) {
    case 'char': return 'bg-blue-500/20 text-blue-400'
    case 'npc': return 'bg-amber-500/20 text-amber-400'
    case 'location': return 'bg-green-500/20 text-green-400'
    case 'feature': return 'bg-teal-500/20 text-teal-400'
    case 'pin': return 'bg-purple-500/20 text-purple-400'
    case 'org': return 'bg-rose-500/20 text-rose-400'
  }
}

/** Trigger character for a given kind */
function kindTriggerChar(kind: MentionKind): string {
  switch (kind) {
    case 'char':
    case 'npc':
      return '@'
    case 'location':
    case 'feature':
    case 'pin':
      return '#'
    case 'org':
      return '\u00A6'
  }
}

const filteredCandidates = computed(() => {
  const q = mentionSearch.value.toLowerCase()
  let candidates = allCandidates.value
  if (mentionTrigger.value === '@') {
    candidates = candidates.filter(c => c.kind === 'char' || c.kind === 'npc')
  } else if (mentionTrigger.value === '#') {
    candidates = candidates.filter(c => c.kind === 'location' || c.kind === 'feature' || c.kind === 'pin')
  } else if (mentionTrigger.value === '\u00A6') {
    candidates = candidates.filter(c => c.kind === 'org')
  }
  if (!q) return candidates.slice(0, 10)
  return candidates.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10)
})

/**
 * Group filtered candidates by kind, preserving order, for sectioned display.
 * Returns an array of { kind, label, candidates } groups.
 */
const groupedCandidates = computed(() => {
  const list = filteredCandidates.value
  const groups: { kind: MentionKind; label: string; candidates: MentionCandidate[] }[] = []
  const seen = new Set<MentionKind>()
  for (const c of list) {
    if (!seen.has(c.kind)) {
      seen.add(c.kind)
      groups.push({ kind: c.kind, label: kindGroupLabel(c.kind), candidates: [] })
    }
    groups.find(g => g.kind === c.kind)!.candidates.push(c)
  }
  return groups
})

function onInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement
  emit('update:modelValue', textarea.value)
  checkForMention(textarea)
}

function checkForMention(textarea: HTMLTextAreaElement) {
  const cursorPos = textarea.selectionStart
  const text = textarea.value
  // Look backwards from cursor for a trigger character that starts a mention
  let triggerIndex = -1
  let triggerChar: TriggerChar | null = null
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i]!
    if (TRIGGER_CHARS.has(ch)) {
      // Check if it's at start or preceded by whitespace
      if (i === 0 || /\s/.test(text[i - 1]!)) {
        triggerIndex = i
        triggerChar = ch as TriggerChar
      }
      break
    }
    if (/\s/.test(ch)) break
  }

  if (triggerIndex >= 0 && triggerChar) {
    mentionStartIndex.value = triggerIndex
    mentionTrigger.value = triggerChar
    mentionSearch.value = text.substring(triggerIndex + 1, cursorPos)
    showDropdown.value = true
    selectedIndex.value = 0
    loadCandidates()
    positionDropdown(textarea, triggerIndex)
  } else {
    showDropdown.value = false
    mentionTrigger.value = null
  }
}

function positionDropdown(textarea: HTMLTextAreaElement, _atIndex: number) {
  const rect = textarea.getBoundingClientRect()
  // Position below the textarea - simple approach
  dropdownPos.value = {
    top: rect.bottom + 4,
    left: rect.left,
  }
}

function selectCandidate(candidate: MentionCandidate) {
  const textarea = textareaRef.value
  if (!textarea) return

  const text = props.modelValue
  const cursorPos = textarea.selectionStart
  const before = text.substring(0, mentionStartIndex.value)
  const after = text.substring(cursorPos)
  const prefix = kindTriggerChar(candidate.kind)
  const token = `${prefix}[${candidate.name}](${candidate.kind}:${candidate.id})`
  const newText = before + token + ' ' + after

  emit('update:modelValue', newText)
  showDropdown.value = false
  mentionTrigger.value = null

  nextTick(() => {
    if (textareaRef.value) {
      const newCursorPos = before.length + token.length + 1
      textareaRef.value.selectionStart = newCursorPos
      textareaRef.value.selectionEnd = newCursorPos
      textareaRef.value.focus()
    }
  })
}

function onKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredCandidates.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (filteredCandidates.value.length > 0) {
      e.preventDefault()
      selectCandidate(filteredCandidates.value[selectedIndex.value]!)
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
    mentionTrigger.value = null
  }
}

function onBlur() {
  // Delay to allow click on dropdown item
  setTimeout(() => {
    showDropdown.value = false
    mentionTrigger.value = null
  }, 200)
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.mention-dropdown') && target !== textareaRef.value) {
    showDropdown.value = false
    mentionTrigger.value = null
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  _mentionUnsubs.forEach(fn => fn())
})
</script>

<template>
  <div class="relative">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :class="['input w-full', inputClass]"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />

    <!-- Mention dropdown -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-75"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-50"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div
          v-if="showDropdown && filteredCandidates.length > 0"
          class="mention-dropdown fixed z-[200] bg-zinc-900 border border-white/10 rounded-lg shadow-2xl max-h-48 overflow-y-auto min-w-[200px] max-w-[300px]"
          :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }"
        >
          <template v-for="group in groupedCandidates" :key="group.kind">
            <!-- Section header (only when there's more than one group) -->
            <div
              v-if="groupedCandidates.length > 1"
              class="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold select-none"
            >
              {{ group.label }}
            </div>
            <button
              v-for="c in group.candidates"
              :key="c.id"
              :class="[
                'w-full text-left px-3 py-2 flex items-center gap-2 transition-colors text-sm',
                filteredCandidates.indexOf(c) === selectedIndex ? 'bg-[#ef233c]/15 text-white' : 'text-zinc-300 hover:bg-white/5'
              ]"
              @mousedown.prevent="selectCandidate(c)"
              @mouseenter="selectedIndex = filteredCandidates.indexOf(c)"
            >
              <span :class="['text-xs shrink-0 rounded-full px-1.5 py-0.5', kindBadgeClass(c.kind)]">
                {{ kindIcon(c.kind) }}
              </span>
              <span class="truncate font-medium">{{ c.name }}</span>
              <span v-if="c.detail" class="text-zinc-600 text-xs truncate">{{ c.detail }}</span>
            </button>
          </template>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

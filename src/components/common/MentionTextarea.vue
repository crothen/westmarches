<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'

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
  kind: 'char' | 'npc' | 'location' | 'feature' | 'org'
  detail?: string
}

type TriggerChar = '@' | '#' | '¦'

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showDropdown = ref(false)
const mentionSearch = ref('')
const mentionStartIndex = ref(-1)
const selectedIndex = ref(0)
const activeTrigger = ref<TriggerChar | null>(null)
const dropdownPos = ref({ top: 0, left: 0 })

// Separate loaded flags per trigger type
const loadedAt = ref(false)
const loadedHash = ref(false)
const loadedPipe = ref(false)

const _mentionUnsubs: (() => void)[] = []

// @ trigger candidates
const charCandidates = ref<MentionCandidate[]>([])
const npcCandidates = ref<MentionCandidate[]>([])

// # trigger candidates
const locationCandidates = ref<MentionCandidate[]>([])
const featureCandidates = ref<MentionCandidate[]>([])

// ¦ trigger candidates
const orgCandidates = ref<MentionCandidate[]>([])

function loadAtCandidates() {
  if (loadedAt.value) return
  loadedAt.value = true

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
}

function loadHashCandidates() {
  if (loadedHash.value) return
  loadedHash.value = true

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
}

function loadPipeCandidates() {
  if (loadedPipe.value) return
  loadedPipe.value = true

  _mentionUnsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    orgCandidates.value = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, name: data.name, kind: 'org' as const, detail: '' }
    })
  }, (e) => console.warn('Failed to load organization candidates:', e)))
}

const activeCandidates = computed<MentionCandidate[]>(() => {
  if (activeTrigger.value === '@') {
    return [...charCandidates.value, ...npcCandidates.value]
  }
  if (activeTrigger.value === '#') {
    return [...locationCandidates.value, ...featureCandidates.value]
  }
  if (activeTrigger.value === '¦') {
    return [...orgCandidates.value]
  }
  return []
})

const filteredCandidates = computed(() => {
  const q = mentionSearch.value.toLowerCase()
  const candidates = activeCandidates.value
  if (!q) return candidates.slice(0, 10)
  return candidates
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 10)
})

const TRIGGER_CHARS = new Set<string>(['@', '#', '¦'])

function onInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement
  emit('update:modelValue', textarea.value)
  checkForMention(textarea)
}

function checkForMention(textarea: HTMLTextAreaElement) {
  const cursorPos = textarea.selectionStart
  const text = textarea.value
  // Look backwards from cursor for a trigger char that starts a mention
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
    mentionSearch.value = text.substring(triggerIndex + 1, cursorPos)
    activeTrigger.value = triggerChar
    showDropdown.value = true
    selectedIndex.value = 0

    // Lazy-load candidates per trigger
    if (triggerChar === '@') loadAtCandidates()
    else if (triggerChar === '#') loadHashCandidates()
    else if (triggerChar === '¦') loadPipeCandidates()

    positionDropdown(textarea, triggerIndex)
  } else {
    showDropdown.value = false
    activeTrigger.value = null
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

const TOKEN_PREFIX: Record<MentionCandidate['kind'], string> = {
  char: '@',
  npc: '@',
  location: '#',
  feature: '#',
  org: '¦',
}

function selectCandidate(candidate: MentionCandidate) {
  const textarea = textareaRef.value
  if (!textarea) return

  const text = props.modelValue
  const cursorPos = textarea.selectionStart
  const before = text.substring(0, mentionStartIndex.value)
  const after = text.substring(cursorPos)
  const prefix = TOKEN_PREFIX[candidate.kind]
  const token = `${prefix}[${candidate.name}](${candidate.kind}:${candidate.id})`
  const newText = before + token + ' ' + after

  emit('update:modelValue', newText)
  showDropdown.value = false
  activeTrigger.value = null

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
  }
}

function onBlur() {
  // Delay to allow click on dropdown item
  setTimeout(() => { showDropdown.value = false }, 200)
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.mention-dropdown') && target !== textareaRef.value) {
    showDropdown.value = false
  }
}

function getBadgeClass(kind: MentionCandidate['kind']): string {
  switch (kind) {
    case 'char': return 'bg-blue-500/20 text-blue-400'
    case 'npc': return 'bg-amber-500/20 text-amber-400'
    case 'location': return 'bg-green-500/20 text-green-400'
    case 'feature': return 'bg-purple-500/20 text-purple-400'
    case 'org': return 'bg-rose-500/20 text-rose-400'
    default: return 'bg-white/10 text-zinc-400'
  }
}

function getBadgeEmoji(kind: MentionCandidate['kind']): string {
  switch (kind) {
    case 'char': return '🧙'
    case 'npc': return '👤'
    case 'location': return '📍'
    case 'feature': return '📌'
    case 'org': return '🏛️'
    default: return '❓'
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
          <button
            v-for="(c, i) in filteredCandidates"
            :key="c.kind + ':' + c.id"
            :class="[
              'w-full text-left px-3 py-2 flex items-center gap-2 transition-colors text-sm',
              i === selectedIndex ? 'bg-[#ef233c]/15 text-white' : 'text-zinc-300 hover:bg-white/5'
            ]"
            @mousedown.prevent="selectCandidate(c)"
            @mouseenter="selectedIndex = i"
          >
            <span :class="['text-xs shrink-0 rounded-full px-1.5 py-0.5', getBadgeClass(c.kind)]">
              {{ getBadgeEmoji(c.kind) }}
            </span>
            <span class="truncate font-medium">{{ c.name }}</span>
            <span v-if="c.detail" class="text-zinc-600 text-xs truncate">{{ c.detail }}</span>
          </button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

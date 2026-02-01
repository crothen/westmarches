<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
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
  kind: 'char' | 'npc'
  detail?: string  // e.g. race, class
}

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showDropdown = ref(false)
const mentionSearch = ref('')
const mentionStartIndex = ref(-1)
const selectedIndex = ref(0)
const allCandidates = ref<MentionCandidate[]>([])
const dropdownPos = ref({ top: 0, left: 0 })
const loaded = ref(false)

async function loadCandidates() {
  if (loaded.value) return
  try {
    const [charSnap, npcSnap] = await Promise.all([
      getDocs(query(collection(db, 'characters'), orderBy('name', 'asc'))),
      getDocs(query(collection(db, 'npcs'), orderBy('name', 'asc'))),
    ])
    const chars: MentionCandidate[] = charSnap.docs.map(d => {
      const data = d.data()
      return { id: d.id, name: data.name, kind: 'char' as const, detail: `${data.race} ${data.class}` }
    })
    const npcs: MentionCandidate[] = npcSnap.docs.map(d => {
      const data = d.data()
      return { id: d.id, name: data.name, kind: 'npc' as const, detail: data.race || '' }
    })
    // Characters first, then NPCs
    allCandidates.value = [...chars, ...npcs]
    loaded.value = true
  } catch (e) {
    console.warn('Failed to load mention candidates:', e)
  }
}

const filteredCandidates = computed(() => {
  const q = mentionSearch.value.toLowerCase()
  if (!q) return allCandidates.value.slice(0, 10)
  return allCandidates.value
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 10)
})

function onInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement
  emit('update:modelValue', textarea.value)
  checkForMention(textarea)
}

function checkForMention(textarea: HTMLTextAreaElement) {
  const cursorPos = textarea.selectionStart
  const text = textarea.value
  // Look backwards from cursor for an @ that starts a mention
  let atIndex = -1
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i]
    if (ch === '@') {
      // Check if it's at start or preceded by whitespace
      if (i === 0 || /\s/.test(text[i - 1]!)) {
        atIndex = i
      }
      break
    }
    if (/\s/.test(ch!)) break
  }

  if (atIndex >= 0) {
    mentionStartIndex.value = atIndex
    mentionSearch.value = text.substring(atIndex + 1, cursorPos)
    showDropdown.value = true
    selectedIndex.value = 0
    loadCandidates()
    positionDropdown(textarea, atIndex)
  } else {
    showDropdown.value = false
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
  const token = `@[${candidate.name}](${candidate.kind}:${candidate.id})`
  const newText = before + token + ' ' + after

  emit('update:modelValue', newText)
  showDropdown.value = false

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

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
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
            :key="c.id"
            :class="[
              'w-full text-left px-3 py-2 flex items-center gap-2 transition-colors text-sm',
              i === selectedIndex ? 'bg-[#ef233c]/15 text-white' : 'text-zinc-300 hover:bg-white/5'
            ]"
            @mousedown.prevent="selectCandidate(c)"
            @mouseenter="selectedIndex = i"
          >
            <span :class="['text-xs shrink-0 rounded-full px-1.5 py-0.5', c.kind === 'char' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400']">
              {{ c.kind === 'char' ? '🧙' : '👤' }}
            </span>
            <span class="truncate font-medium">{{ c.name }}</span>
            <span v-if="c.detail" class="text-zinc-600 text-xs truncate">{{ c.detail }}</span>
          </button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

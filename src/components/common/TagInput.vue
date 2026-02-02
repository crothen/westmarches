<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [tags: string[]]
}>()

const newTag = ref('')
const showSuggestions = ref(false)
const allKnownTags = ref<string[]>([])

let _unsub: (() => void) | null = null

onMounted(() => {
  _unsub = onSnapshot(query(collection(db, 'npcs')), (snap) => {
    const tagSet = new Set<string>()
    snap.docs.forEach(d => {
      const tags = d.data().tags as string[] | undefined
      if (tags) tags.forEach(t => tagSet.add(t))
    })
    allKnownTags.value = Array.from(tagSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  }, (e) => console.warn('Failed to load tags:', e))
})

onUnmounted(() => _unsub?.())

const suggestions = computed(() => {
  const q = newTag.value.toLowerCase().trim()
  if (!q) return allKnownTags.value.filter(t => !props.modelValue.includes(t)).slice(0, 15)
  return allKnownTags.value
    .filter(t => t.toLowerCase().includes(q) && !props.modelValue.includes(t))
    .slice(0, 10)
})

function addTag(tag: string) {
  const t = tag.trim()
  if (!t || props.modelValue.includes(t)) return
  emit('update:modelValue', [...props.modelValue, t])
  newTag.value = ''
  showSuggestions.value = false
}

function removeTag(tag: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (newTag.value.trim()) {
      addTag(newTag.value)
    }
  }
  if (e.key === 'Backspace' && !newTag.value && props.modelValue.length) {
    removeTag(props.modelValue[props.modelValue.length - 1]!)
  }
}

function onBlur() {
  // Delay to allow click on suggestion
  setTimeout(() => { showSuggestions.value = false }, 150)
}
</script>

<template>
  <div>
    <!-- Current tags as chips -->
    <div class="flex flex-wrap gap-1.5 mb-2" v-if="modelValue.length">
      <span
        v-for="tag in modelValue" :key="tag"
        class="inline-flex items-center gap-1 text-xs bg-white/10 text-zinc-300 px-2 py-1 rounded-full"
      >
        {{ tag }}
        <button @click="removeTag(tag)" class="text-zinc-500 hover:text-red-400 transition-colors ml-0.5" type="button">×</button>
      </span>
    </div>

    <!-- Input with autocomplete -->
    <div class="relative">
      <input
        v-model="newTag"
        @focus="showSuggestions = true"
        @blur="onBlur"
        @keydown="onKeydown"
        type="text"
        placeholder="Type to add a tag..."
        class="input w-full text-sm"
      />

      <!-- Suggestions dropdown -->
      <div
        v-if="showSuggestions && suggestions.length > 0"
        class="absolute z-20 mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg shadow-xl max-h-40 overflow-y-auto"
      >
        <button
          v-for="tag in suggestions" :key="tag"
          @mousedown.prevent="addTag(tag)"
          class="w-full text-left px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
          type="button"
        >
          {{ tag }}
        </button>
        <button
          v-if="newTag.trim() && !allKnownTags.includes(newTag.trim())"
          @mousedown.prevent="addTag(newTag)"
          class="w-full text-left px-3 py-1.5 text-sm text-[#ef233c] hover:bg-[#ef233c]/10 transition-colors border-t border-white/[0.06]"
          type="button"
        >
          + Create "{{ newTag.trim() }}"
        </button>
      </div>
    </div>
  </div>
</template>

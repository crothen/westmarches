<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  modelValue: string | null | undefined  // YYYY-MM-DD format
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const day = ref<number | null>(null)
const month = ref<number | null>(null)
const year = ref<number | null>(null)

// Parse incoming value
watch(() => props.modelValue, (val) => {
  if (val) {
    const parts = val.split('-')
    if (parts.length === 3) {
      year.value = parseInt(parts[0] ?? '0', 10) || null
      month.value = parseInt(parts[1] ?? '0', 10) || null
      day.value = parseInt(parts[2] ?? '0', 10) || null
    }
  } else {
    day.value = null
    month.value = null
    year.value = null
  }
}, { immediate: true })

// Emit changes
function emitDate() {
  if (year.value && month.value && day.value) {
    const y = String(year.value).padStart(4, '0')
    const m = String(month.value).padStart(2, '0')
    const d = String(day.value).padStart(2, '0')
    emit('update:modelValue', `${y}-${m}-${d}`)
  } else {
    emit('update:modelValue', null)
  }
}

const months = [
  { value: 1, label: 'Hammer (Jan)' },
  { value: 2, label: 'Alturiak (Feb)' },
  { value: 3, label: 'Ches (Mar)' },
  { value: 4, label: 'Tarsakh (Apr)' },
  { value: 5, label: 'Mirtul (May)' },
  { value: 6, label: 'Kythorn (Jun)' },
  { value: 7, label: 'Flamerule (Jul)' },
  { value: 8, label: 'Eleasis (Aug)' },
  { value: 9, label: 'Eleint (Sep)' },
  { value: 10, label: 'Marpenoth (Oct)' },
  { value: 11, label: 'Uktar (Nov)' },
  { value: 12, label: 'Nightal (Dec)' },
]

const daysInMonth = computed(() => {
  if (!month.value || !year.value) return 31
  // Simple approximation - most months have 30 days in FR calendar
  // but we'll use standard logic for simplicity
  return new Date(year.value, month.value, 0).getDate()
})
</script>

<template>
  <div class="flex gap-2">
    <input
      v-model.number="day"
      type="number"
      min="1"
      :max="daysInMonth"
      class="input w-16 text-center"
      placeholder="DD"
      @change="emitDate"
    />
    <select v-model.number="month" class="input flex-1" @change="emitDate">
      <option :value="null" disabled>Month</option>
      <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
    </select>
    <input
      v-model.number="year"
      type="number"
      min="1"
      max="9999"
      class="input w-20 text-center"
      placeholder="Year"
      @change="emitDate"
    />
  </div>
</template>

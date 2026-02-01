<script setup lang="ts">
import { computed } from 'vue'
import type { TypeOption } from '../../composables/useTypeConfig'

const props = defineProps<{
  modelValue: string
  options: TypeOption[]
  placeholder?: string
  inputClass?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectedOption = computed(() =>
  props.options.find(o => o.key === props.modelValue)
)
</script>

<template>
  <div class="flex items-center gap-2">
    <img
      v-if="selectedOption"
      :src="selectedOption.iconUrl"
      class="w-5 h-5 object-contain shrink-0"
      :alt="selectedOption.label"
    />
    <div v-else class="w-5 h-5 shrink-0 rounded bg-white/5" />
    <select
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      :class="['input flex-1', inputClass || '']"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.key" :value="opt.key">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

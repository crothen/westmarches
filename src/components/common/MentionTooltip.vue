<script setup lang="ts">
import { computed } from 'vue'
import { useEntityTooltip } from '../../composables/useEntityTooltip'

const { tooltipState, keepTooltip, hideTooltip } = useEntityTooltip()

const kindLabel: Record<string, string> = {
  char: '🧙 Character',
  npc: '👤 NPC',
  location: '📍 Location',
  feature: '📌 Feature',
  org: '🏛️ Organization',
}

const kindBorderColor: Record<string, string> = {
  char: 'border-blue-500/40',
  npc: 'border-amber-500/40',
  location: 'border-green-500/40',
  feature: 'border-teal-500/40',
  org: 'border-rose-500/40',
}

const style = computed(() => ({
  left: `${tooltipState.x}px`,
  top: `${tooltipState.y}px`,
}))
</script>

<template>
  <Teleport to="body">
    <Transition name="tooltip">
      <div
        v-if="tooltipState.visible && tooltipState.current"
        class="fixed z-[9999] pointer-events-auto"
        :style="style"
        @mouseenter="keepTooltip"
        @mouseleave="hideTooltip"
      >
        <div
          :class="[
            'bg-zinc-900/95 backdrop-blur-sm border rounded-lg shadow-xl p-3 max-w-xs',
            kindBorderColor[tooltipState.current.kind] || 'border-white/10'
          ]"
        >
          <!-- Loading -->
          <div v-if="tooltipState.current.loading" class="text-zinc-500 text-xs animate-pulse">Loading...</div>

          <!-- Content -->
          <template v-else>
            <div class="text-[0.6rem] uppercase tracking-wider text-zinc-600 font-semibold mb-1" style="font-family: Manrope, sans-serif">
              {{ kindLabel[tooltipState.current.kind] || tooltipState.current.kind }}
            </div>
            <div class="text-sm font-semibold text-zinc-100 mb-1">{{ tooltipState.current.name }}</div>

            <!-- Character: race, class, level -->
            <div v-if="tooltipState.current.kind === 'char'" class="text-xs text-zinc-400 space-y-0.5">
              <div v-if="tooltipState.current.race || tooltipState.current.class">
                {{ tooltipState.current.race }} {{ tooltipState.current.class }}
              </div>
              <div v-if="tooltipState.current.level">Level {{ tooltipState.current.level }}</div>
            </div>

            <!-- NPC: tags -->
            <div v-else-if="tooltipState.current.kind === 'npc' && tooltipState.current.tags?.length" class="flex flex-wrap gap-1 mt-1">
              <span
                v-for="tag in tooltipState.current.tags.slice(0, 5)"
                :key="tag"
                class="text-[0.6rem] bg-white/[0.06] text-zinc-500 px-1.5 py-0.5 rounded"
              >{{ tag }}</span>
            </div>

            <!-- Location / Feature / Org: description -->
            <template v-else-if="['location', 'feature', 'org'].includes(tooltipState.current.kind)">
              <div v-if="tooltipState.current.type" class="text-[0.65rem] text-zinc-500 capitalize mb-1">{{ tooltipState.current.type }}</div>
              <div v-if="tooltipState.current.description" class="text-xs text-zinc-400 leading-relaxed">
                {{ tooltipState.current.description }}{{ (tooltipState.current.description?.length || 0) >= 150 ? '…' : '' }}
              </div>
            </template>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tooltip-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tooltip-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.tooltip-enter-from, .tooltip-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>

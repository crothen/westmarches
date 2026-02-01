<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { Npc } from '../../types'

const props = defineProps<{
  npcId: string
  name?: string  // optional override — if not provided, fetches from Firestore
}>()

const npc = ref<Npc | null>(null)
const showCard = ref(false)
const cardPos = ref({ x: 0, y: 0 })
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  if (!props.name) {
    try {
      const snap = await getDoc(doc(db, 'npcs', props.npcId))
      if (snap.exists()) npc.value = { id: snap.id, ...snap.data() } as Npc
    } catch { /* ignore */ }
  }
})

function onMouseEnter(e: MouseEvent) {
  if (hoverTimeout) clearTimeout(hoverTimeout)
  hoverTimeout = setTimeout(async () => {
    if (!npc.value) {
      try {
        const snap = await getDoc(doc(db, 'npcs', props.npcId))
        if (snap.exists()) npc.value = { id: snap.id, ...snap.data() } as Npc
      } catch { /* ignore */ }
    }
    if (npc.value) {
      // Position card near cursor but keep it in viewport
      const x = Math.min(e.clientX, window.innerWidth - 280)
      const y = Math.min(e.clientY + 16, window.innerHeight - 200)
      cardPos.value = { x, y }
      showCard.value = true
    }
  }, 300)
}

function onMouseLeave() {
  if (hoverTimeout) clearTimeout(hoverTimeout)
  hoverTimeout = null
  showCard.value = false
}
</script>

<template>
  <RouterLink
    :to="'/npcs/' + npcId"
    class="text-zinc-300 hover:text-[#ef233c] transition-colors inline"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    {{ name || npc?.name || npcId }}
  </RouterLink>

  <Teleport to="body">
    <transition
      enter-active-class="transition-all duration-150"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showCard && npc"
        class="fixed z-[100] w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-none"
        :style="{ left: cardPos.x + 'px', top: cardPos.y + 'px' }"
      >
        <div v-if="npc.imageUrl" class="overflow-hidden">
          <img :src="npc.imageUrl" class="w-full h-24 object-cover" />
        </div>
        <div class="p-3">
          <h4 class="text-sm font-semibold text-white" style="font-family: Manrope, sans-serif">{{ npc.name }}</h4>
          <span class="text-xs text-zinc-500">{{ npc.race }}</span>
          <p class="text-xs text-zinc-400 mt-1 line-clamp-3">{{ npc.description }}</p>
          <div v-if="npc.locationEncountered" class="text-[0.6rem] text-zinc-600 mt-1">📍 {{ npc.locationEncountered }}</div>
          <div class="text-[0.55rem] text-zinc-700 mt-1.5">Click to view full profile →</div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

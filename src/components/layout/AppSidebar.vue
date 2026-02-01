<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()
const auth = useAuthStore()

const navItems = [
  { to: '/', label: 'Home', icon: '🏠', show: 'all' },
  { to: '/characters', label: 'Characters', icon: '🧙', show: 'all' },
  { to: '/locations', label: 'Locations', icon: '📍', show: 'all' },
  { to: '/map', label: 'Map', icon: '🗺️', show: 'all' },
  { to: '/inventory', label: 'Inventory', icon: '🎒', show: 'all' },
  { to: '/npcs', label: 'NPCs', icon: '👤', show: 'all' },
  { to: '/organizations', label: 'Organizations', icon: '🏛️', show: 'all' },
  { to: '/sessions', label: 'Session Log', icon: '📖', show: 'all' },
  { to: '/missions', label: 'Missions', icon: '⚔️', show: 'all' },
  { to: '/schedule', label: 'Schedule', icon: '📅', show: 'all' },
  { to: '/dm', label: 'DM Panel', icon: '📋', show: 'dm' },
  { to: '/admin', label: 'Admin', icon: '⚙️', show: 'admin' },
]
</script>

<template>
  <div v-if="open" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 lg:hidden" @click="$emit('close')" />

  <aside
    :class="[
      'w-52 min-h-[calc(100vh-72px)] border-r border-white/[0.06]',
      'bg-black/40 backdrop-blur-xl',
      'fixed lg:sticky lg:top-[72px] lg:self-start z-30 transition-transform duration-200 lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <nav class="p-3 space-y-0.5 mt-1">
      <template v-for="item in navItems" :key="item.to">
        <RouterLink
          v-if="item.show === 'all' || (item.show === 'dm' && auth.isDm) || (item.show === 'admin' && auth.isAdmin)"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-150"
          active-class="!text-[#ef233c] bg-[#ef233c]/[0.06] hover:!bg-[#ef233c]/[0.1]"
          @click="$emit('close')"
        >
          <span class="text-sm w-5 text-center">{{ item.icon }}</span>
          <span class="font-medium">{{ item.label }}</span>
        </RouterLink>
      </template>
    </nav>
  </aside>
</template>

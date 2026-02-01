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
  <!-- Overlay for mobile -->
  <div v-if="open" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden" @click="$emit('close')" />

  <aside
    :class="[
      'w-56 min-h-[calc(100vh-3.5rem)] border-r border-white/[0.06]',
      'bg-[var(--bg-secondary)]/50 backdrop-blur-xl',
      'fixed lg:static z-30 transition-transform duration-200 lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <nav class="p-3 space-y-0.5 mt-2">
      <template v-for="item in navItems" :key="item.to">
        <RouterLink
          v-if="item.show === 'all' || (item.show === 'dm' && auth.isDm) || (item.show === 'admin' && auth.isAdmin)"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] transition-all duration-150"
          active-class="!text-amber-500 bg-amber-500/[0.08] hover:!bg-amber-500/[0.12]"
          @click="$emit('close')"
        >
          <span class="text-base w-5 text-center">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </template>
    </nav>
  </aside>
</template>

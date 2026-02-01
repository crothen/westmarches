<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const auth = useAuthStore()

const navItems = [
  { to: '/', label: '🏠 Home', show: 'all' },
  { to: '/characters', label: '🧙 Characters', show: 'all' },
  { to: '/locations', label: '📍 Locations', show: 'all' },
  { to: '/map', label: '🗺️ Map', show: 'all' },
  { to: '/inventory', label: '🎒 Inventory', show: 'all' },
  { to: '/npcs', label: '👤 NPCs', show: 'all' },
  { to: '/organizations', label: '🏛️ Organizations', show: 'all' },
  { to: '/sessions', label: '📖 Session Log', show: 'all' },
  { to: '/dm', label: '📋 DM Panel', show: 'dm' },
  { to: '/admin', label: '⚙️ Admin', show: 'admin' },
]
</script>

<template>
  <!-- Overlay for mobile -->
  <div v-if="open" class="fixed inset-0 bg-black/50 z-20 lg:hidden" @click="$emit('close')" />

  <aside
    :class="[
      'w-56 bg-stone-800 border-r border-stone-700 min-h-[calc(100vh-3.5rem)]',
      'fixed lg:static z-30 transition-transform lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <nav class="p-4 space-y-1">
      <template v-for="item in navItems" :key="item.to">
        <RouterLink
          v-if="item.show === 'all' || (item.show === 'dm' && auth.isDm) || (item.show === 'admin' && auth.isAdmin)"
          :to="item.to"
          class="block px-3 py-2 rounded text-stone-300 hover:bg-stone-700 hover:text-amber-500 transition-colors"
          active-class="bg-stone-700 text-amber-500"
          @click="$emit('close')"
        >
          {{ item.label }}
        </RouterLink>
      </template>
    </nav>
  </aside>
</template>

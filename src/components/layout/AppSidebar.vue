<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()
const auth = useAuthStore()

interface NavItem {
  to: string
  label: string
  icon: string
  show: 'all' | 'dm' | 'admin'
  sub?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    title: '',
    items: [
      { to: '/', label: 'Home', icon: '🏠', show: 'all' },
    ]
  },
  {
    title: 'World',
    items: [
      { to: '/map', label: 'Map', icon: '🗺️', show: 'all' },
      { to: '/locations', label: 'Locations', icon: '📍', show: 'all' },
      { to: '/features', label: 'Points of Interest', icon: '📌', show: 'all' },
    ]
  },
  {
    title: 'People',
    items: [
      { to: '/characters', label: 'Characters', icon: '🧙', show: 'all' },
      { to: '/npcs', label: 'NPCs', icon: '👤', show: 'all' },
    ]
  },
  {
    title: 'Factions & Missions',
    items: [
      { to: '/organizations', label: 'Organizations', icon: '🏛️', show: 'all' },
      { to: '/missions', label: 'Missions', icon: '⚔️', show: 'all' },
    ]
  },
  {
    title: 'Journal',
    items: [
      { to: '/sessions', label: 'Sessions', icon: '📖', show: 'all' },
      { to: '/schedule', label: 'Schedule', icon: '📅', show: 'all' },
      { to: '/inventory', label: 'Inventory', icon: '🎒', show: 'all' },
      { to: '/my-notes', label: 'My Notes', icon: '📝', show: 'all' },
    ]
  },
  {
    title: 'Management',
    items: [
      { to: '/dm', label: 'DM Panel', icon: '📋', show: 'dm' },
      { to: '/admin', label: 'Admin', icon: '⚙️', show: 'admin' },
      { to: '/admin/users', label: 'Users', icon: '👥', show: 'admin', sub: true },
      { to: '/admin/markers', label: 'Markers', icon: '📌', show: 'admin', sub: true },
      { to: '/admin/tiles', label: 'Tiles', icon: '🗺️', show: 'admin', sub: true },
      { to: '/admin/session-locations', label: 'Session Locations', icon: '📍', show: 'admin', sub: true },
    ]
  },
]

function isVisible(item: NavItem): boolean {
  if (item.show === 'all') return true
  if (item.show === 'dm') return auth.isDm || auth.isAdmin
  if (item.show === 'admin') return auth.isAdmin
  return false
}

function hasVisibleItems(section: NavSection): boolean {
  return section.items.some(isVisible)
}
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
    <nav class="p-3 mt-1">
      <template v-for="(section, si) in sections" :key="si">
        <div v-if="hasVisibleItems(section)">
          <!-- Section title -->
          <div v-if="section.title" class="px-3 pt-4 pb-1.5 first:pt-0">
            <span class="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-zinc-600" style="font-family: Manrope, sans-serif">{{ section.title }}</span>
          </div>

          <!-- Items -->
          <RouterLink
            v-for="item in section.items.filter(isVisible)" :key="item.to"
            :to="item.to"
            :class="[
              'flex items-center gap-2.5 py-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-150',
              item.sub ? 'pl-8 pr-3 text-xs' : 'px-3 text-sm'
            ]"
            active-class="!text-[#ef233c] bg-[#ef233c]/[0.06] hover:!bg-[#ef233c]/[0.1]"
            @click="$emit('close')"
          >
            <span :class="['text-center', item.sub ? 'text-xs w-4' : 'text-sm w-5']">{{ item.icon }}</span>
            <span class="font-medium">{{ item.label }}</span>
          </RouterLink>
        </div>
      </template>
    </nav>
  </aside>
</template>

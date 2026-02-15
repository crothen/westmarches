<script setup lang="ts">
import { type Component } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
import { 
  Home, MapPin, Landmark, Building2, Calendar, CalendarDays, 
  Backpack, Star, Sparkles, Wrench, Settings, UserCog, 
  Map as MapIcon, Dice5
} from 'lucide-vue-next'
import GameIcon from '../icons/GameIcon.vue'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()
const auth = useAuthStore()
const router = useRouter()

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

interface NavItem {
  to: string
  label: string
  icon: Component | string
  isGameIcon?: boolean
  show: 'all' | 'player' | 'dm' | 'admin'
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
      { to: '/', label: 'Home', icon: Home, show: 'all' },
    ]
  },
  {
    title: 'World',
    items: [
      { to: '/map', label: 'Map', icon: 'compass', isGameIcon: true, show: 'all' },
      { to: '/locations', label: 'Locations', icon: 'castle', isGameIcon: true, show: 'all' },
      { to: '/features', label: 'Points of Interest', icon: MapPin, show: 'all' },
    ]
  },
  {
    title: 'People',
    items: [
      { to: '/characters', label: 'Characters', icon: 'warrior', isGameIcon: true, show: 'all' },
      { to: '/npcs', label: 'NPCs', icon: 'npc', isGameIcon: true, show: 'all' },
    ]
  },
  {
    title: 'Factions & Missions',
    items: [
      { to: '/organizations', label: 'Organizations', icon: Building2, show: 'all' },
      { to: '/missions', label: 'Missions', icon: 'swords', isGameIcon: true, show: 'all' },
    ]
  },
  {
    title: 'Journal',
    items: [
      { to: '/sessions', label: 'Sessions', icon: 'scroll', isGameIcon: true, show: 'all' },
      { to: '/calendar', label: 'Calendar', icon: Calendar, show: 'all' },
      { to: '/schedule', label: 'Schedule', icon: CalendarDays, show: 'player' },
      { to: '/inventory', label: 'Inventory', icon: Backpack, show: 'player' },
      { to: '/my-notes', label: 'My Notes', icon: 'quill', isGameIcon: true, show: 'player' },
      { to: '/saved', label: 'Saved', icon: Star, show: 'player' },
    ]
  },
  {
    title: 'Management',
    items: [
      { to: '/generate', label: 'Generate', icon: Sparkles, show: 'player' },
      { to: '/tools', label: 'Tools', icon: Wrench, show: 'all' },
      { to: '/admin', label: 'Admin', icon: Settings, show: 'admin' },
      { to: '/admin/campaign', label: 'Campaign', icon: Dice5, show: 'dm', sub: true },
      { to: '/admin/users', label: 'Users', icon: UserCog, show: 'admin', sub: true },
      { to: '/admin/markers', label: 'Markers', icon: MapPin, show: 'admin', sub: true },
      { to: '/admin/tiles', label: 'Tiles', icon: MapIcon, show: 'admin', sub: true },
      { to: '/admin/session-locations', label: 'Session Locations', icon: Landmark, show: 'admin', sub: true },
    ]
  },
]

function isVisible(item: NavItem): boolean {
  if (item.show === 'all') return true
  if (item.show === 'player') return !auth.isGuest
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
      'w-56 h-[calc(100vh-49px)] border-r border-white/[0.06]',
      'bg-black/40 backdrop-blur-xl',
      'fixed lg:sticky lg:top-[49px] lg:self-start z-30 transition-transform duration-200 lg:translate-x-0 flex flex-col',
      open ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <nav class="p-3 mt-1 flex-1 overflow-y-auto pb-[50px]">
      <template v-for="(section, si) in sections" :key="si">
        <div v-if="hasVisibleItems(section)">
          <!-- Section title -->
          <div v-if="section.title" class="px-3 pt-4 pb-1.5 first:pt-0">
            <span class="text-xs font-bold uppercase tracking-[0.15em] text-zinc-600" style="font-family: Manrope, sans-serif">{{ section.title }}</span>
          </div>

          <!-- Items -->
          <RouterLink
            v-for="item in section.items.filter(isVisible)" :key="item.to"
            :to="item.to"
            :class="[
              'flex items-center gap-2.5 py-2.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-150',
              item.sub ? 'pl-8 pr-3 text-sm' : 'px-3 text-[0.9375rem]'
            ]"
            active-class="!text-[#ef233c] bg-[#ef233c]/[0.06] hover:!bg-[#ef233c]/[0.1]"
            @click="$emit('close')"
          >
            <span :class="['flex items-center justify-center', item.sub ? 'w-4' : 'w-5']">
              <GameIcon v-if="item.isGameIcon" :name="item.icon as string" :size="item.sub ? 16 : 18" />
              <component v-else :is="item.icon" :size="item.sub ? 16 : 18" :stroke-width="2" />
            </span>
            <span class="font-medium">{{ item.label }}</span>
          </RouterLink>
        </div>
      </template>
    </nav>

    <!-- User controls at bottom -->
    <div class="shrink-0 border-t border-white/[0.06] p-3">
      <div v-if="auth.isGuest" class="px-2 space-y-2">
        <div class="text-sm text-zinc-500 font-medium">👁️ Guest Mode</div>
        <RouterLink to="/login" class="text-[#ef233c] hover:text-red-400 text-sm transition-colors" @click="handleLogout">Sign In</RouterLink>
      </div>
      <div v-else class="px-2 space-y-2">
        <RouterLink to="/profile" class="text-[0.9375rem] text-zinc-400 font-medium truncate hover:text-white transition-colors block" @click="$emit('close')">{{ auth.appUser?.displayName }}</RouterLink>
        <div class="flex flex-wrap gap-1">
          <span v-for="r in auth.roles" :key="r" class="text-[0.65rem] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest" :class="r === 'admin' ? 'bg-[#ef233c]/10 text-[#ef233c]' : r === 'dm' ? 'bg-purple-500/10 text-purple-400' : 'bg-white/5 text-zinc-400'" style="font-family: Manrope, sans-serif">{{ r }}</span>
        </div>
        <button @click="handleLogout" class="text-zinc-600 hover:text-white text-sm transition-colors">Logout</button>
      </div>
    </div>
  </aside>
</template>

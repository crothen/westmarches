<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()

const cards = [
  { to: '/map', icon: '🗺️', title: 'World Map', desc: 'Explore the hex map', span: true },
  { to: '/characters', icon: '🧙', title: 'Characters', desc: 'View and manage adventurers' },
  { to: '/missions', icon: '⚔️', title: 'Missions', desc: 'Available missions by unit' },
  { to: '/schedule', icon: '📅', title: 'Schedule', desc: 'Upcoming sessions & voting' },
  { to: '/sessions', icon: '📖', title: 'Session Log', desc: 'Campaign session history' },
  { to: '/locations', icon: '📍', title: 'Locations', desc: 'Known places and landmarks' },
  { to: '/npcs', icon: '👤', title: 'NPCs', desc: "People you've encountered" },
  { to: '/organizations', icon: '🏛️', title: 'Organizations', desc: 'Factions and guilds' },
  { to: '/inventory', icon: '🎒', title: 'Inventory', desc: 'Shared loot and supplies' },
]
</script>

<template>
  <div>
    <div v-if="!auth.isAuthenticated" class="text-center mt-32">
      <div class="w-8 h-8 bg-[#ef233c] rounded-sm rotate-45 mx-auto mb-6"></div>
      <h1 class="text-5xl md:text-7xl font-bold tracking-tighter mb-4" style="font-family: Manrope, sans-serif">
        <span class="text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">West Marches</span>
      </h1>
      <p class="text-zinc-500 text-lg mb-10">A collaborative exploration campaign</p>
      <RouterLink to="/login" class="btn !rounded-full !py-3 !px-10">Enter</RouterLink>
    </div>
    <div v-else>
      <div class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">
          Welcome back, <span class="text-[#ef233c]">{{ auth.appUser?.displayName }}</span>
        </h1>
        <p class="text-zinc-600 text-sm mt-1">What would you like to explore?</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <RouterLink
          v-for="card in cards" :key="card.to" :to="card.to"
          :class="['card p-6 group cursor-pointer relative z-10', card.span ? 'sm:col-span-2' : '']"
        >
          <div class="relative z-10">
            <div class="text-2xl mb-3 group-hover:scale-110 transition-transform duration-200 inline-block">{{ card.icon }}</div>
            <h2 class="text-base font-semibold text-white group-hover:text-[#ef233c] transition-colors" style="font-family: Manrope, sans-serif">{{ card.title }}</h2>
            <p class="text-zinc-600 text-sm mt-1">{{ card.desc }}</p>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

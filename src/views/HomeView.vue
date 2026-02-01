<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const cards = [
  { to: '/characters', icon: '🧙', title: 'Characters', desc: 'View and manage adventurers' },
  { to: '/map', icon: '🗺️', title: 'World Map', desc: 'Explore the hex map' },
  { to: '/locations', icon: '📍', title: 'Locations', desc: 'Known places and landmarks' },
  { to: '/npcs', icon: '👤', title: 'NPCs', desc: "People you've encountered" },
  { to: '/organizations', icon: '🏛️', title: 'Organizations', desc: 'Factions and guilds' },
  { to: '/inventory', icon: '🎒', title: 'Party Inventory', desc: 'Shared loot and supplies' },
  { to: '/sessions', icon: '📖', title: 'Session Log', desc: 'Campaign session history' },
  { to: '/missions', icon: '⚔️', title: 'Missions', desc: 'Available missions by unit' },
  { to: '/schedule', icon: '📅', title: 'Schedule', desc: 'Upcoming sessions & voting' },
]
</script>

<template>
  <div>
    <div v-if="!auth.isAuthenticated" class="text-center mt-20">
      <div class="text-5xl mb-4">⚔️</div>
      <h1 class="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent mb-3">West Marches</h1>
      <p class="text-slate-400 text-lg mb-8">A collaborative exploration campaign</p>
      <RouterLink to="/login" class="btn-primary text-base !py-2.5 !px-8">Enter</RouterLink>
    </div>
    <div v-else>
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-slate-100">Welcome back, <span class="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">{{ auth.appUser?.displayName }}</span></h1>
        <p class="text-slate-500 text-sm mt-1">What would you like to explore?</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RouterLink
          v-for="card in cards" :key="card.to" :to="card.to"
          class="glass-card p-5 group cursor-pointer"
        >
          <div class="text-2xl mb-3 group-hover:scale-110 transition-transform duration-200 inline-block">{{ card.icon }}</div>
          <h2 class="text-base font-semibold text-slate-100 group-hover:text-amber-500 transition-colors">{{ card.title }}</h2>
          <p class="text-slate-500 text-sm mt-1">{{ card.desc }}</p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

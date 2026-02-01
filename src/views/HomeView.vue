<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div>
    <div v-if="!auth.isAuthenticated" class="text-center mt-20">
      <h1 class="text-4xl font-bold text-amber-500 mb-4">⚔️ West Marches</h1>
      <p class="text-stone-400 text-lg mb-8">A collaborative exploration campaign</p>
      <RouterLink to="/login" class="bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold px-6 py-3 rounded transition-colors">
        Enter
      </RouterLink>
    </div>
    <div v-else>
      <h1 class="text-3xl font-bold text-amber-500 mb-6">Welcome, {{ auth.appUser?.displayName }}</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RouterLink v-for="card in [
          { to: '/characters', icon: '🧙', title: 'Characters', desc: 'View and manage adventurers' },
          { to: '/map', icon: '🗺️', title: 'World Map', desc: 'Explore the hex map' },
          { to: '/locations', icon: '📍', title: 'Locations', desc: 'Known places and landmarks' },
          { to: '/npcs', icon: '👤', title: 'NPCs', desc: 'People you\'ve encountered' },
          { to: '/organizations', icon: '🏛️', title: 'Organizations', desc: 'Factions and guilds' },
          { to: '/inventory', icon: '🎒', title: 'Party Inventory', desc: 'Shared loot and supplies' },
          { to: '/sessions', icon: '📖', title: 'Session Log', desc: 'Campaign session history' },
        ]" :key="card.to" :to="card.to"
          class="bg-stone-800 border border-stone-700 rounded-lg p-6 hover:border-amber-500/50 transition-colors group"
        >
          <div class="text-3xl mb-3">{{ card.icon }}</div>
          <h2 class="text-lg font-semibold text-stone-100 group-hover:text-amber-500 transition-colors">{{ card.title }}</h2>
          <p class="text-stone-400 text-sm mt-1">{{ card.desc }}</p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

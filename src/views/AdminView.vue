<script setup lang="ts">
const sections = [
  { to: '/admin/users', icon: '👥', label: 'User Management', desc: 'Manage users, assign roles (player, DM, admin).' },
  { to: '/admin/markers', icon: '📌', label: 'Marker Management', desc: 'Edit marker types, labels, and icons for locations, features, and hex tags.' },
  { to: '/admin/tiles', icon: '🗺️', label: 'Tile Management', desc: 'Manage terrain types, colors, and textures. Generate textures with AI.' },
  { to: '/admin/session-locations', icon: '📍', label: 'Session Locations', desc: 'Manage where sessions take place — online, game stores, etc.' },
]
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-white mb-2" style="font-family: Manrope, sans-serif">⚙️ Admin Panel</h1>
    <p class="text-zinc-500 text-sm mb-8">Campaign configuration and management.</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink
        v-for="s in sections" :key="s.to"
        :to="s.to"
        class="card-flat p-6 hover:border-white/15 transition-all duration-200 group"
      >
        <div class="text-3xl mb-3">{{ s.icon }}</div>
        <h3 class="text-base font-semibold text-zinc-200 group-hover:text-[#ef233c] transition-colors mb-1" style="font-family: Manrope, sans-serif">{{ s.label }}</h3>
        <p class="text-sm text-zinc-500">{{ s.desc }}</p>
      </RouterLink>
    </div>
  </div>
</template>

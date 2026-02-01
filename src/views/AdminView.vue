<script setup lang="ts">
import { ref } from 'vue'
import AdminUsers from '../components/admin/AdminUsers.vue'
import AdminMarkers from '../components/admin/AdminMarkers.vue'
import AdminTiles from '../components/admin/AdminTiles.vue'

type AdminTab = 'users' | 'markers' | 'tiles'

const activeTab = ref<AdminTab>('users')

const tabs: { key: AdminTab; label: string; icon: string }[] = [
  { key: 'users', label: 'Users', icon: '👥' },
  { key: 'markers', label: 'Markers', icon: '📌' },
  { key: 'tiles', label: 'Tiles', icon: '🗺️' },
]
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">⚙️ Admin Panel</h1>
    </div>

    <!-- Tab Navigation -->
    <div class="flex gap-1 mb-6 border-b border-white/[0.06]">
      <button
        v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key"
        :class="[
          'flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all relative',
          activeTab === tab.key
            ? 'text-white bg-white/[0.04] border border-white/[0.08] border-b-transparent -mb-px z-10'
            : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02]'
        ]"
        style="font-family: Manrope, sans-serif"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Tab Content -->
    <KeepAlive>
      <AdminUsers v-if="activeTab === 'users'" />
      <AdminMarkers v-else-if="activeTab === 'markers'" />
      <AdminTiles v-else-if="activeTab === 'tiles'" />
    </KeepAlive>
  </div>
</template>

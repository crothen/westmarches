<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/map', icon: '🗺️', label: 'Map' },
  { to: '/sessions', icon: '📖', label: 'Sessions' },
  { to: '/npcs', icon: '👤', label: 'NPCs' },
  { to: '/profile', icon: '⚙️', label: 'Profile' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="pwa-bottom-nav">
    <RouterLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      :class="['pwa-nav-item', { active: isActive(item.to) }]"
    >
      <span class="pwa-nav-icon">{{ item.icon }}</span>
      <span class="pwa-nav-label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.pwa-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(60px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  z-index: 1000;
}

.pwa-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  text-decoration: none;
  color: #888;
  transition: color 0.15s;
  height: 60px;
}

.pwa-nav-item.active {
  color: #ef233c;
}

.pwa-nav-icon {
  font-size: 22px;
  line-height: 1;
}

.pwa-nav-label {
  font-size: 10px;
  margin-top: 4px;
  font-weight: 500;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Globe, Compass, Star, X } from 'lucide-vue-next'
import GameIcon from '../icons/GameIcon.vue'

const route = useRoute()
const router = useRouter()

const activeSheet = ref<string | null>(null)

interface SubItem {
  to: string
  label: string
  icon: string
  isGameIcon?: boolean
}

interface NavItem {
  id: string
  label: string
  icon: any
  isGameIcon?: boolean
  to?: string  // Direct navigation
  items?: SubItem[]  // Submenu items
}

const navItems: NavItem[] = [
  { 
    id: 'home',
    label: 'Home', 
    icon: Home,
    to: '/'
  },
  { 
    id: 'map',
    label: 'Map', 
    icon: Compass,
    to: '/map'
  },
  { 
    id: 'world',
    label: 'World', 
    icon: Globe,
    items: [
      { to: '/locations', label: 'Locations', icon: 'castle', isGameIcon: true },
      { to: '/features', label: 'Points of Interest', icon: 'pin', isGameIcon: true },
      { to: '/npcs', label: 'NPCs', icon: 'npc', isGameIcon: true },
      { to: '/characters', label: 'Characters', icon: 'warrior', isGameIcon: true },
      { to: '/organizations', label: 'Organizations', icon: 'guild', isGameIcon: true },
    ]
  },
  { 
    id: 'adventures',
    label: 'Adventures', 
    icon: 'swords',
    isGameIcon: true,
    items: [
      { to: '/sessions', label: 'Sessions', icon: 'scroll', isGameIcon: true },
      { to: '/missions', label: 'Missions', icon: 'swords', isGameIcon: true },
      { to: '/schedule', label: 'Schedule', icon: 'calendar', isGameIcon: true },
      { to: '/calendar', label: 'Calendar', icon: 'calendar', isGameIcon: true },
    ]
  },
  { 
    id: 'you',
    label: 'You', 
    icon: Star,
    items: [
      { to: '/saved', label: 'Saved', icon: 'star', isGameIcon: true },
      { to: '/my-notes', label: 'My Notes', icon: 'quill', isGameIcon: true },
      { to: '/inventory', label: 'Inventory', icon: 'chest', isGameIcon: true },
      { to: '/profile', label: 'Settings', icon: 'gear', isGameIcon: true },
    ]
  },
]

function isActive(item: NavItem): boolean {
  const path = route.path
  
  // Direct nav item
  if (item.to) {
    if (item.to === '/') return path === '/'
    return path.startsWith(item.to)
  }
  
  // Check if any sub-item matches
  if (item.items) {
    return item.items.some(sub => path.startsWith(sub.to))
  }
  
  return false
}

function handleNavClick(item: NavItem) {
  if (item.to) {
    // Direct navigation
    router.push(item.to)
    activeSheet.value = null
  } else if (item.items) {
    // Toggle submenu
    activeSheet.value = activeSheet.value === item.id ? null : item.id
  }
}

function navigateToSub(to: string) {
  router.push(to)
  activeSheet.value = null
}

function closeSheet() {
  activeSheet.value = null
}

const currentSheet = computed(() => {
  if (!activeSheet.value) return null
  return navItems.find(item => item.id === activeSheet.value)
})
</script>

<template>
  <nav class="pwa-bottom-nav">
    <div class="pwa-nav-items">
      <button
        v-for="item in navItems"
        :key="item.id"
        @click="handleNavClick(item)"
        :class="['pwa-nav-item', { 
          active: isActive(item),
          open: activeSheet === item.id 
        }]"
      >
        <span class="pwa-nav-icon">
          <GameIcon v-if="item.isGameIcon" :name="item.icon as string" :size="24" />
          <component v-else :is="item.icon" :size="24" :stroke-width="1.5" />
        </span>
        <span class="pwa-nav-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>

  <!-- Submenu Sheet -->
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="activeSheet" class="pwa-sheet-overlay" @click.self="closeSheet">
        <div class="pwa-sheet">
          <div class="pwa-sheet-handle" @click="closeSheet"></div>
          <div class="pwa-sheet-header">
            <h3>{{ currentSheet?.label }}</h3>
            <button @click="closeSheet" class="pwa-sheet-close">
              <X :size="20" />
            </button>
          </div>
          <div class="pwa-sheet-items">
            <button
              v-for="sub in currentSheet?.items"
              :key="sub.to"
              @click="navigateToSub(sub.to)"
              :class="['pwa-sheet-item', { active: route.path.startsWith(sub.to) }]"
            >
              <span class="pwa-sheet-icon">
                <GameIcon v-if="sub.isGameIcon" :name="sub.icon" :size="22" />
              </span>
              <span class="pwa-sheet-label">{{ sub.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pwa-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(72px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: rgba(10, 10, 10, 0.98);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 100;
}

.pwa-nav-items {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 72px;
  padding: 0 8px;
}

.pwa-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 64px;
  max-width: 80px;
  border-radius: 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.pwa-nav-item:active {
  transform: scale(0.95);
}

.pwa-nav-item.active {
  color: #ef233c;
}

.pwa-nav-item.active .pwa-nav-icon {
  filter: drop-shadow(0 0 8px rgba(239, 35, 60, 0.5));
}

.pwa-nav-item.open {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.pwa-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
}

.pwa-nav-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Sheet styles */
.pwa-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.pwa-sheet {
  width: 100%;
  background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px 24px 0 0;
  padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
}

.pwa-sheet-handle {
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: 12px auto;
  cursor: pointer;
}

.pwa-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 16px;
}

.pwa-sheet-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: white;
  margin: 0;
}

.pwa-sheet-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.pwa-sheet-items {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 0 16px 16px;
}

.pwa-sheet-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.15s;
}

.pwa-sheet-item:active {
  transform: scale(0.97);
  background: rgba(255, 255, 255, 0.1);
}

.pwa-sheet-item.active {
  background: rgba(239, 35, 60, 0.15);
  border-color: rgba(239, 35, 60, 0.3);
  color: #ef233c;
}

.pwa-sheet-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.pwa-sheet-item.active .pwa-sheet-icon {
  background: rgba(239, 35, 60, 0.2);
}

.pwa-sheet-label {
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
}

/* Sheet animation */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-active .pwa-sheet,
.sheet-leave-active .pwa-sheet {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .pwa-sheet,
.sheet-leave-to .pwa-sheet {
  transform: translateY(100%);
}
</style>

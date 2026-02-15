<script setup lang="ts">
import { ref, watch, onMounted, nextTick, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Settings, Star } from 'lucide-vue-next'
import GameIcon from '../icons/GameIcon.vue'

const route = useRoute()
const router = useRouter()
const navRef = ref<HTMLElement | null>(null)

interface NavItem {
  to: string
  label: string
  icon: Component | string
  isGameIcon?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/map', label: 'Map', icon: 'compass', isGameIcon: true },
  { to: '/sessions', label: 'Sessions', icon: 'scroll', isGameIcon: true },
  { to: '/npcs', label: 'NPCs', icon: 'npc', isGameIcon: true },
  { to: '/characters', label: 'Characters', icon: 'warrior', isGameIcon: true },
  { to: '/locations', label: 'Locations', icon: 'castle', isGameIcon: true },
  { to: '/missions', label: 'Missions', icon: 'swords', isGameIcon: true },
  { to: '/saved', label: 'Saved', icon: Star },
  { to: '/my-notes', label: 'Notes', icon: 'quill', isGameIcon: true },
  { to: '/profile', label: 'Settings', icon: Settings },
]

function getActiveIndex(): number {
  const path = route.path
  const idx = navItems.findIndex(item => {
    if (item.to === '/') return path === '/'
    return path.startsWith(item.to)
  })
  return idx >= 0 ? idx : 0
}

const activeIndex = ref(getActiveIndex())

watch(() => route.path, () => {
  activeIndex.value = getActiveIndex()
  scrollToActive()
})

function scrollToActive() {
  nextTick(() => {
    if (!navRef.value) return
    const activeEl = navRef.value.children[activeIndex.value] as HTMLElement
    if (!activeEl) return
    
    const navWidth = navRef.value.offsetWidth
    const itemLeft = activeEl.offsetLeft
    const itemWidth = activeEl.offsetWidth
    const scrollPos = itemLeft - (navWidth / 2) + (itemWidth / 2)
    
    navRef.value.scrollTo({
      left: scrollPos,
      behavior: 'smooth'
    })
  })
}

function navigate(index: number) {
  const item = navItems[index]
  if (!item) return
  activeIndex.value = index
  router.push(item.to)
}

onMounted(() => {
  scrollToActive()
})
</script>

<template>
  <nav class="pwa-bottom-nav">
    <div ref="navRef" class="pwa-nav-scroll">
      <button
        v-for="(item, index) in navItems"
        :key="item.to"
        @click="navigate(index)"
        :class="['pwa-nav-item', { active: index === activeIndex }]"
      >
        <span class="pwa-nav-icon">
          <GameIcon v-if="item.isGameIcon" :name="item.icon as string" :size="24" />
          <component v-else :is="item.icon" :size="24" :stroke-width="2" />
        </span>
        <span class="pwa-nav-label">{{ item.label }}</span>
      </button>
    </div>
    <!-- Center indicator line -->
    <div class="pwa-nav-indicator"></div>
  </nav>
</template>

<style scoped>
.pwa-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(72px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.98), rgba(10, 10, 10, 0.95));
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-nav-scroll {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 calc(50vw - 44px);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  height: 72px;
}

.pwa-nav-scroll::-webkit-scrollbar {
  display: none;
}

.pwa-nav-item {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  scroll-snap-align: center;
  cursor: pointer;
  transform: scale(0.85);
  opacity: 0.6;
}

.pwa-nav-item.active {
  background: rgba(239, 35, 60, 0.15);
  color: #ef233c;
  transform: scale(1);
  opacity: 1;
  box-shadow: 0 0 20px rgba(239, 35, 60, 0.3);
}

.pwa-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.pwa-nav-item.active .pwa-nav-icon {
  transform: scale(1.1);
}

.pwa-nav-label {
  font-size: 10px;
  font-weight: 600;
  margin-top: 4px;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.2s ease;
}

.pwa-nav-item.active .pwa-nav-label {
  opacity: 1;
  transform: translateY(0);
}

.pwa-nav-indicator {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 3px;
  background: #ef233c;
  border-radius: 0 0 3px 3px;
  box-shadow: 0 0 10px rgba(239, 35, 60, 0.5);
}

/* Fade edges */
.pwa-bottom-nav::before,
.pwa-bottom-nav::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 60px;
  pointer-events: none;
  z-index: 1;
}

.pwa-bottom-nav::before {
  left: 0;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.95), transparent);
}

.pwa-bottom-nav::after {
  right: 0;
  background: linear-gradient(to left, rgba(0, 0, 0, 0.95), transparent);
}
</style>

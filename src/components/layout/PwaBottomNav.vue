<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Settings, Star } from 'lucide-vue-next'
import GameIcon from '../icons/GameIcon.vue'

const route = useRoute()
const router = useRouter()
const navRef = ref<HTMLElement | null>(null)
const centerIndex = ref(0)

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

// Triple the items for infinite loop illusion
const loopedItems = [...navItems, ...navItems, ...navItems]
const baseOffset = navItems.length

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
  scrollToIndex(activeIndex.value + baseOffset, true)
})

function scrollToIndex(index: number, smooth = true) {
  nextTick(() => {
    if (!navRef.value) return
    const items = navRef.value.children
    const targetEl = items[index] as HTMLElement
    if (!targetEl) return
    
    const navWidth = navRef.value.offsetWidth
    const itemLeft = targetEl.offsetLeft
    const itemWidth = targetEl.offsetWidth
    const scrollPos = itemLeft - (navWidth / 2) + (itemWidth / 2)
    
    navRef.value.scrollTo({
      left: scrollPos,
      behavior: smooth ? 'smooth' : 'instant'
    })
  })
}

function updateCenterItem() {
  if (!navRef.value) return
  
  const navRect = navRef.value.getBoundingClientRect()
  const centerX = navRect.left + navRect.width / 2
  
  let closestIndex = 0
  let closestDist = Infinity
  
  const items = navRef.value.children
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as HTMLElement
    const rect = item.getBoundingClientRect()
    const itemCenterX = rect.left + rect.width / 2
    const dist = Math.abs(itemCenterX - centerX)
    
    if (dist < closestDist) {
      closestDist = dist
      closestIndex = i
    }
  }
  
  centerIndex.value = closestIndex
}

function handleScrollEnd() {
  if (!navRef.value) return
  
  updateCenterItem()
  
  // Snap to center item
  scrollToIndex(centerIndex.value, true)
  
  // Handle loop wrap-around
  const realIndex = centerIndex.value % navItems.length
  
  // If we're in the first or last set, jump to middle set
  if (centerIndex.value < navItems.length) {
    // In first set - jump to middle
    setTimeout(() => scrollToIndex(realIndex + baseOffset, false), 300)
  } else if (centerIndex.value >= navItems.length * 2) {
    // In last set - jump to middle
    setTimeout(() => scrollToIndex(realIndex + baseOffset, false), 300)
  }
}

let scrollTimeout: number | null = null

function onScroll() {
  updateCenterItem()
  
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = window.setTimeout(handleScrollEnd, 150)
}

function navigate(index: number) {
  const realIndex = index % navItems.length
  const item = navItems[realIndex]
  if (!item) return
  activeIndex.value = realIndex
  router.push(item.to)
}

function isActive(index: number): boolean {
  return (index % navItems.length) === activeIndex.value
}

function isCenter(index: number): boolean {
  return index === centerIndex.value
}

onMounted(() => {
  scrollToIndex(activeIndex.value + baseOffset, false)
  navRef.value?.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  navRef.value?.removeEventListener('scroll', onScroll)
  if (scrollTimeout) clearTimeout(scrollTimeout)
})
</script>

<template>
  <nav class="pwa-bottom-nav">
    <div ref="navRef" class="pwa-nav-scroll">
      <button
        v-for="(item, index) in loopedItems"
        :key="`${item.to}-${index}`"
        @click="navigate(index)"
        :class="['pwa-nav-item', { active: isActive(index), center: isCenter(index) }]"
      >
        <span class="pwa-nav-icon">
          <GameIcon v-if="item.isGameIcon" :name="item.icon as string" :size="28" />
          <component v-else :is="item.icon" :size="28" :stroke-width="1.5" />
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
  height: calc(80px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.98), rgba(10, 10, 10, 0.95));
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-nav-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 calc(50vw - 36px);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  height: 80px;
  scroll-behavior: auto;
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
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  transform: scale(0.8);
}

.pwa-nav-item.center {
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1);
}

.pwa-nav-item.center .pwa-nav-label {
  opacity: 1;
  transform: translateY(0);
}

.pwa-nav-item.active {
  background: rgba(239, 35, 60, 0.2);
  color: #ef233c;
  box-shadow: 0 0 24px rgba(239, 35, 60, 0.4);
}

.pwa-nav-item.active.center {
  transform: scale(1.05);
}

.pwa-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.pwa-nav-label {
  font-size: 11px;
  font-weight: 600;
  margin-top: 4px;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.pwa-nav-indicator {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 3px;
  background: linear-gradient(90deg, transparent, #ef233c, transparent);
  border-radius: 0 0 3px 3px;
}

/* Fade edges */
.pwa-bottom-nav::before,
.pwa-bottom-nav::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 80px;
  pointer-events: none;
  z-index: 1;
}

.pwa-bottom-nav::before {
  left: 0;
  background: linear-gradient(to right, rgba(0, 0, 0, 1), transparent);
}

.pwa-bottom-nav::after {
  right: 0;
  background: linear-gradient(to left, rgba(0, 0, 0, 1), transparent);
}
</style>

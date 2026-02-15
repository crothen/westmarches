<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Settings, Star } from 'lucide-vue-next'
import GameIcon from '../icons/GameIcon.vue'

const route = useRoute()
const router = useRouter()
const navRef = ref<HTMLElement | null>(null)
const centerIndex = ref(0)
const isDragging = ref(false)

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
    
    // Calculate scale based on distance from center
    const maxDist = 100
    const scale = Math.max(0.7, 1 - (dist / maxDist) * 0.3)
    item.style.transform = `scale(${scale})`
    
    if (dist < closestDist) {
      closestDist = dist
      closestIndex = i
    }
  }
  
  centerIndex.value = closestIndex
}

function handleScrollEnd() {
  if (!navRef.value) return
  isDragging.value = false
  
  updateCenterItem()
  
  // Snap to center item
  scrollToIndex(centerIndex.value, true)
  
  // Handle loop wrap-around
  const realIndex = centerIndex.value % navItems.length
  
  // If we're in the first or last set, jump to middle set
  if (centerIndex.value < navItems.length) {
    setTimeout(() => scrollToIndex(realIndex + baseOffset, false), 300)
  } else if (centerIndex.value >= navItems.length * 2) {
    setTimeout(() => scrollToIndex(realIndex + baseOffset, false), 300)
  }
}

let scrollTimeout: number | null = null

function onScroll() {
  isDragging.value = true
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
  // Initial scale calculation
  setTimeout(updateCenterItem, 100)
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
        <span class="pwa-nav-icon-wrap" :class="{ 'active-circle': isActive(index) }">
          <GameIcon v-if="item.isGameIcon" :name="item.icon as string" :size="26" />
          <component v-else :is="item.icon" :size="26" :stroke-width="1.5" />
        </span>
        <span class="pwa-nav-label">{{ item.label }}</span>
      </button>
    </div>
    <!-- Center marker -->
    <div class="pwa-nav-center-marker"></div>
  </nav>
</template>

<style scoped>
.pwa-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(88px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: linear-gradient(to top, rgba(0, 0, 0, 1), rgba(10, 10, 10, 0.98));
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-nav-scroll {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 calc(50vw - 40px);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  height: 88px;
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
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.15s;
  transform-origin: center;
}

.pwa-nav-item.center {
  color: rgba(255, 255, 255, 1);
}

.pwa-nav-item.center .pwa-nav-label {
  opacity: 1;
  transform: translateY(0);
}

.pwa-nav-icon-wrap {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.pwa-nav-icon-wrap.active-circle {
  background: #ef233c;
  color: white;
  box-shadow: 0 4px 20px rgba(239, 35, 60, 0.5);
}

.pwa-nav-label {
  font-size: 11px;
  font-weight: 600;
  margin-top: 6px;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.pwa-nav-center-marker {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: #ef233c;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(239, 35, 60, 0.8);
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
  background: linear-gradient(to right, rgba(0, 0, 0, 1), transparent);
}

.pwa-bottom-nav::after {
  right: 0;
  background: linear-gradient(to left, rgba(0, 0, 0, 1), transparent);
}
</style>

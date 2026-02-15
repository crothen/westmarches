<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { Menu, Search, User, X, ChevronRight } from 'lucide-vue-next'
import GameIcon from '../icons/GameIcon.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const menuOpen = ref(false)
const searchOpen = ref(false)
const searchQuery = ref('')

const menuSections = [
  {
    title: 'Explore',
    items: [
      { to: '/map', label: 'Map', icon: 'compass', isGameIcon: true },
      { to: '/locations', label: 'Locations', icon: 'castle', isGameIcon: true },
      { to: '/features', label: 'Points of Interest', icon: 'map', isGameIcon: true },
    ]
  },
  {
    title: 'People',
    items: [
      { to: '/characters', label: 'Characters', icon: 'warrior', isGameIcon: true },
      { to: '/npcs', label: 'NPCs', icon: 'npc', isGameIcon: true },
      { to: '/organizations', label: 'Organizations', icon: 'castle', isGameIcon: true },
    ]
  },
  {
    title: 'Adventures',
    items: [
      { to: '/sessions', label: 'Sessions', icon: 'scroll', isGameIcon: true },
      { to: '/missions', label: 'Missions', icon: 'swords', isGameIcon: true },
      { to: '/calendar', label: 'Calendar', icon: 'scroll', isGameIcon: true },
      { to: '/schedule', label: 'Schedule', icon: 'scroll', isGameIcon: true },
    ]
  },
  {
    title: 'Your Stuff',
    items: [
      { to: '/saved', label: 'Saved', icon: 'compass', isGameIcon: true },
      { to: '/my-notes', label: 'Notes', icon: 'quill', isGameIcon: true },
      { to: '/inventory', label: 'Inventory', icon: 'map', isGameIcon: true },
    ]
  },
  {
    title: 'Tools',
    items: [
      { to: '/generate', label: 'Generate', icon: 'compass', isGameIcon: true },
      { to: '/tools', label: 'Tools', icon: 'swords', isGameIcon: true },
    ]
  },
]

function navigate(to: string) {
  menuOpen.value = false
  router.push(to)
}

function goToProfile() {
  router.push('/profile')
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    // TODO: implement search
    searchOpen.value = false
    searchQuery.value = ''
  }
}

// Get page title from route
function getPageTitle(): string {
  const path = route.path
  if (path === '/') return 'West Marches'
  if (path.startsWith('/map')) return 'Map'
  if (path.startsWith('/sessions')) return 'Sessions'
  if (path.startsWith('/npcs')) return 'NPCs'
  if (path.startsWith('/characters')) return 'Characters'
  if (path.startsWith('/locations')) return 'Locations'
  if (path.startsWith('/missions')) return 'Missions'
  if (path.startsWith('/saved')) return 'Saved'
  if (path.startsWith('/my-notes')) return 'Notes'
  if (path.startsWith('/profile')) return 'Settings'
  return 'West Marches'
}
</script>

<template>
  <!-- Header -->
  <header class="pwa-header">
    <button @click="menuOpen = true" class="pwa-header-btn">
      <Menu :size="24" />
    </button>
    
    <h1 class="pwa-header-title">{{ getPageTitle() }}</h1>
    
    <div class="pwa-header-actions">
      <button @click="searchOpen = true" class="pwa-header-btn">
        <Search :size="22" />
      </button>
      <button @click="goToProfile" class="pwa-header-avatar">
        <User :size="20" />
      </button>
    </div>
  </header>

  <!-- Full-screen Menu -->
  <Teleport to="body">
    <transition name="menu-slide">
      <div v-if="menuOpen" class="pwa-menu-overlay" @click.self="menuOpen = false">
        <div class="pwa-menu">
          <div class="pwa-menu-header">
            <h2>Menu</h2>
            <button @click="menuOpen = false" class="pwa-menu-close">
              <X :size="24" />
            </button>
          </div>
          
          <div class="pwa-menu-content">
            <div v-for="section in menuSections" :key="section.title" class="pwa-menu-section">
              <div class="pwa-menu-section-title">{{ section.title }}</div>
              <button 
                v-for="item in section.items" 
                :key="item.to"
                @click="navigate(item.to)"
                :class="['pwa-menu-item', { active: route.path.startsWith(item.to) }]"
              >
                <span class="pwa-menu-icon">
                  <GameIcon v-if="item.isGameIcon" :name="item.icon" :size="22" />
                </span>
                <span class="pwa-menu-label">{{ item.label }}</span>
                <ChevronRight :size="18" class="pwa-menu-arrow" />
              </button>
            </div>
          </div>
          
          <div class="pwa-menu-footer">
            <div class="pwa-menu-user" @click="navigate('/profile')">
              <div class="pwa-menu-user-avatar">
                <User :size="24" />
              </div>
              <div class="pwa-menu-user-info">
                <div class="pwa-menu-user-name">{{ auth.appUser?.displayName || 'User' }}</div>
                <div class="pwa-menu-user-email">{{ auth.appUser?.email }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Search overlay -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="searchOpen" class="pwa-search-overlay">
        <div class="pwa-search-header">
          <button @click="searchOpen = false" class="pwa-search-back">
            <X :size="24" />
          </button>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search..." 
            class="pwa-search-input"
            autofocus
            @keyup.enter="handleSearch"
          />
        </div>
        <div class="pwa-search-content">
          <p class="pwa-search-hint">Search for NPCs, locations, sessions...</p>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.pwa-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: calc(56px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 8px;
  padding-right: 8px;
  z-index: 100;
}

.pwa-header-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
}

.pwa-header-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.pwa-header-title {
  font-size: 18px;
  font-weight: 600;
  color: white;
  font-family: Manrope, sans-serif;
}

.pwa-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pwa-header-avatar {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 35, 60, 0.2);
  border: none;
  color: #ef233c;
  border-radius: 50%;
  cursor: pointer;
}

/* Menu */
.pwa-menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
}

.pwa-menu {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 300px;
  max-width: 85vw;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
}

.pwa-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  padding-top: calc(16px + env(safe-area-inset-top, 0px));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.pwa-menu-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: white;
  font-family: Manrope, sans-serif;
}

.pwa-menu-close {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.pwa-menu-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.pwa-menu-section {
  margin-bottom: 24px;
}

.pwa-menu-section-title {
  padding: 0 20px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  font-family: Manrope, sans-serif;
}

.pwa-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 20px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.pwa-menu-item:active {
  background: rgba(255, 255, 255, 0.05);
}

.pwa-menu-item.active {
  color: #ef233c;
  background: rgba(239, 35, 60, 0.1);
}

.pwa-menu-icon {
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.pwa-menu-label {
  flex: 1;
}

.pwa-menu-arrow {
  color: rgba(255, 255, 255, 0.3);
}

.pwa-menu-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

.pwa-menu-user {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.pwa-menu-user-avatar {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 35, 60, 0.2);
  color: #ef233c;
  border-radius: 50%;
}

.pwa-menu-user-name {
  font-size: 15px;
  font-weight: 600;
  color: white;
}

.pwa-menu-user-email {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

/* Search */
.pwa-search-overlay {
  position: fixed;
  inset: 0;
  background: #0a0a0a;
  z-index: 1000;
}

.pwa-search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  padding-top: calc(8px + env(safe-area-inset-top, 0px));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.pwa-search-back {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.pwa-search-input {
  flex: 1;
  height: 44px;
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  outline: none;
}

.pwa-search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.pwa-search-content {
  padding: 24px 20px;
}

.pwa-search-hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

/* Animations */
.menu-slide-enter-active,
.menu-slide-leave-active {
  transition: opacity 0.2s ease;
}

.menu-slide-enter-active .pwa-menu,
.menu-slide-leave-active .pwa-menu {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-slide-enter-from,
.menu-slide-leave-to {
  opacity: 0;
}

.menu-slide-enter-from .pwa-menu,
.menu-slide-leave-to .pwa-menu {
  transform: translateX(-100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

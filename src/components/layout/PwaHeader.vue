<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useSearch } from '../../composables/useSearch'
import { Menu, Search, User, X, ChevronRight, MapPin, Building2, Calendar, CalendarCheck, Star, Backpack, Sparkles, Wrench } from 'lucide-vue-next'
import GameIcon from '../icons/GameIcon.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const search = useSearch()

const menuOpen = ref(false)
const searchOpen = ref(false)

const menuSections = [
  {
    title: 'Explore',
    items: [
      { to: '/map', label: 'Map', icon: 'compass', isGameIcon: true },
      { to: '/locations', label: 'Locations', icon: 'castle', isGameIcon: true },
      { to: '/features', label: 'Points of Interest', icon: MapPin },
    ]
  },
  {
    title: 'People',
    items: [
      { to: '/characters', label: 'Characters', icon: 'warrior', isGameIcon: true },
      { to: '/npcs', label: 'NPCs', icon: 'npc', isGameIcon: true },
      { to: '/organizations', label: 'Organizations', icon: Building2 },
    ]
  },
  {
    title: 'Adventures',
    items: [
      { to: '/sessions', label: 'Sessions', icon: 'scroll', isGameIcon: true },
      { to: '/missions', label: 'Missions', icon: 'swords', isGameIcon: true },
      { to: '/calendar', label: 'Calendar', icon: Calendar },
      { to: '/schedule', label: 'Schedule', icon: CalendarCheck },
    ]
  },
  {
    title: 'Your Stuff',
    items: [
      { to: '/saved', label: 'Saved', icon: Star },
      { to: '/my-notes', label: 'Notes', icon: 'quill', isGameIcon: true },
      { to: '/inventory', label: 'Inventory', icon: Backpack },
    ]
  },
  {
    title: 'Tools',
    items: [
      { to: '/generate', label: 'Generate', icon: Sparkles },
      { to: '/tools', label: 'Tools', icon: Wrench },
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

function openSearch() {
  searchOpen.value = true
  search.init()
}

function closeSearch() {
  searchOpen.value = false
  search.searchQuery.value = ''
}

function navigateToResult(route: string) {
  closeSearch()
  router.push(route)
}

// Highlight matching text in a string
function highlightMatch(text: string, query: string): string {
  if (!query || query.length < 2) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

onUnmounted(() => {
  search.destroy()
})

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
      <button @click="openSearch" class="pwa-header-btn">
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
                  <component v-else :is="item.icon" :size="22" :stroke-width="1.5" />
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
          <button @click="closeSearch" class="pwa-search-back">
            <X :size="24" />
          </button>
          <input 
            v-model="search.searchQuery.value"
            type="text" 
            placeholder="Search..." 
            class="pwa-search-input"
            autofocus
          />
        </div>
        <div class="pwa-search-content">
          <!-- Loading -->
          <div v-if="search.isLoading.value" class="pwa-search-loading">
            <div class="pwa-search-spinner"></div>
            <span>Loading...</span>
          </div>
          
          <!-- Empty state -->
          <p v-else-if="search.searchQuery.value.length < 2" class="pwa-search-hint">
            Search for NPCs, locations, sessions, and more...
          </p>
          
          <!-- No results -->
          <p v-else-if="search.results.value.length === 0" class="pwa-search-hint">
            No results for "{{ search.searchQuery.value }}"
          </p>
          
          <!-- Results -->
          <div v-else class="pwa-search-results">
            <template v-for="(items, type) in search.groupedResults.value" :key="type">
              <div class="pwa-search-group">
                <div class="pwa-search-group-title">
                  {{ search.typeConfig[type]?.icon }} {{ search.typeConfig[type]?.label }}s
                  <span class="pwa-search-group-count">{{ items.length }}</span>
                </div>
                <button 
                  v-for="item in items.slice(0, 5)" 
                  :key="item.id"
                  @click="navigateToResult(item.route)"
                  class="pwa-search-result"
                >
                  <img 
                    v-if="item.imageUrl" 
                    :src="item.imageUrl" 
                    class="pwa-search-result-img" 
                  />
                  <div v-else class="pwa-search-result-icon">
                    {{ search.typeConfig[item.type]?.icon }}
                  </div>
                  <div class="pwa-search-result-content">
                    <div 
                      class="pwa-search-result-title" 
                      v-html="highlightMatch(item.title, search.searchQuery.value)"
                    ></div>
                    <div v-if="item.subtitle" class="pwa-search-result-subtitle">
                      {{ item.subtitle }}
                    </div>
                    <div class="pwa-search-result-matches">
                      <span 
                        v-for="(match, idx) in item.matches.slice(0, 2)" 
                        :key="idx"
                        class="pwa-search-match-badge"
                        :class="{ 'is-tag': match.isTag, 'is-title': match.isTitle }"
                      >
                        <template v-if="match.isTag">🏷️ {{ match.value }}</template>
                        <template v-else-if="!match.isTitle">{{ match.field }}: <span v-html="highlightMatch(match.value.slice(0, 50), search.searchQuery.value)"></span>{{ match.value.length > 50 ? '...' : '' }}</template>
                      </span>
                    </div>
                  </div>
                  <ChevronRight :size="18" class="pwa-search-result-arrow" />
                </button>
                <div v-if="items.length > 5" class="pwa-search-more">
                  +{{ items.length - 5 }} more
                </div>
              </div>
            </template>
          </div>
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
  padding: 16px;
  overflow-y: auto;
  max-height: calc(100vh - 60px - env(safe-area-inset-top, 0px));
}

.pwa-search-hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
}

.pwa-search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.pwa-search-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #ef233c;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pwa-search-results {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pwa-search-group-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pwa-search-group-count {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 10px;
}

.pwa-search-result {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  margin-bottom: 8px;
}

.pwa-search-result:active {
  background: rgba(255, 255, 255, 0.08);
  transform: scale(0.98);
}

.pwa-search-result-img {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.pwa-search-result-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.pwa-search-result-content {
  flex: 1;
  min-width: 0;
}

.pwa-search-result-title {
  font-size: 15px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pwa-search-result-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

.pwa-search-result-matches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.pwa-search-match-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pwa-search-match-badge.is-tag {
  background: rgba(239, 35, 60, 0.15);
  color: #ef233c;
}

.pwa-search-match-badge.is-title {
  display: none; /* Title matches are obvious from the title */
}

.pwa-search-result-arrow {
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.pwa-search-more {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  padding: 4px 0;
}

/* Search highlight */
:deep(.search-highlight) {
  background: rgba(239, 35, 60, 0.3);
  color: #ef233c;
  padding: 0 2px;
  border-radius: 2px;
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

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guest: true } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { guest: true } },
  { path: '/characters', name: 'characters', component: () => import('../views/CharactersView.vue'), meta: { auth: true } },
  { path: '/characters/:id', name: 'character-detail', component: () => import('../views/CharacterDetailView.vue'), meta: { auth: true } },
  { path: '/locations', name: 'locations', component: () => import('../views/LocationsView.vue'), meta: { auth: true } },
  { path: '/locations/:id', name: 'location-detail', component: () => import('../views/LocationDetailView.vue'), meta: { auth: true } },
  { path: '/features', name: 'features', component: () => import('../views/FeaturesView.vue'), meta: { auth: true } },
  { path: '/features/:id', name: 'feature-detail', component: () => import('../views/FeatureDetailView.vue'), meta: { auth: true } },
  { path: '/map', name: 'map', component: () => import('../views/MapView.vue'), meta: { auth: true } },
  { path: '/inventory', name: 'inventory', component: () => import('../views/InventoryView.vue'), meta: { auth: true } },
  { path: '/npcs', name: 'npcs', component: () => import('../views/NpcsView.vue'), meta: { auth: true } },
  { path: '/npcs/:id', name: 'npc-detail', component: () => import('../views/NpcDetailView.vue'), meta: { auth: true } },
  { path: '/organizations', name: 'organizations', component: () => import('../views/OrganizationsView.vue'), meta: { auth: true } },
  { path: '/sessions', name: 'sessions', component: () => import('../views/SessionsView.vue'), meta: { auth: true } },
  { path: '/sessions/:id', name: 'session-detail', component: () => import('../views/SessionDetailView.vue'), meta: { auth: true } },
  { path: '/sessions/:id/read', name: 'session-reader', component: () => import('../views/SessionReaderView.vue'), meta: { auth: true } },
  { path: '/missions', name: 'missions', component: () => import('../views/MissionsView.vue'), meta: { auth: true } },
  { path: '/schedule', name: 'schedule', component: () => import('../views/ScheduleView.vue'), meta: { auth: true } },
  { path: '/my-notes', name: 'my-notes', component: () => import('../views/MyNotesView.vue'), meta: { auth: true } },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { auth: true, role: 'admin' } },
  { path: '/admin/users', name: 'admin-users', component: () => import('../views/AdminUsersView.vue'), meta: { auth: true, role: 'admin' } },
  { path: '/admin/markers', name: 'admin-markers', component: () => import('../views/AdminMarkersView.vue'), meta: { auth: true, role: 'admin' } },
  { path: '/admin/tiles', name: 'admin-tiles', component: () => import('../views/AdminTilesView.vue'), meta: { auth: true, role: 'admin' } },
  { path: '/admin/session-locations', name: 'admin-session-locations', component: () => import('../views/AdminSessionLocationsView.vue'), meta: { auth: true, role: 'admin' } },
  { path: '/dm', name: 'dm', component: () => import('../views/DmView.vue'), meta: { auth: true, role: 'dm' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Wait for Firebase auth to resolve before checking auth state
  if (authStore.loading) {
    await authStore.waitForAuth()
  }

  if (to.meta.auth && !authStore.isAuthenticated) {
    return next({ name: 'login' })
  }
  if (to.meta.guest && authStore.isAuthenticated) {
    return next({ name: 'home' })
  }
  if (to.meta.role === 'admin' && !authStore.isAdmin) {
    return next({ name: 'home' })
  }
  if (to.meta.role === 'dm' && !authStore.isDm && !authStore.isAdmin) {
    return next({ name: 'home' })
  }
  next()
})

export default router

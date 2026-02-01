import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from 'firebase/auth'
import type { AppUser } from '../types'
import { onAuth, getOrCreateUserProfile, signOut } from '../firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const firebaseUser = ref<User | null>(null)
  const appUser = ref<AppUser | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!firebaseUser.value)
  const roles = computed(() => appUser.value?.roles || ['player'])
  const isAdmin = computed(() => roles.value.includes('admin'))
  const isDm = computed(() => roles.value.includes('dm'))
  const isPlayer = computed(() => roles.value.includes('player'))
  /** Highest privilege role for display purposes */
  const primaryRole = computed(() => {
    if (roles.value.includes('admin')) return 'admin'
    if (roles.value.includes('dm')) return 'dm'
    return 'player'
  })
  /** @deprecated Use `roles` or `primaryRole` instead */
  const role = computed(() => primaryRole.value)

  function hasRole(r: string) {
    return roles.value.includes(r as any)
  }

  function init() {
    onAuth(async (user) => {
      firebaseUser.value = user
      if (user) {
        appUser.value = await getOrCreateUserProfile(user)
      } else {
        appUser.value = null
      }
      loading.value = false
    })
  }

  async function logout() {
    await signOut()
    firebaseUser.value = null
    appUser.value = null
  }

  return { firebaseUser, appUser, loading, isAuthenticated, isAdmin, isDm, isPlayer, roles, primaryRole, role, hasRole, init, logout }
})

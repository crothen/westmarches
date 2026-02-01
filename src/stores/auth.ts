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
  const isAdmin = computed(() => appUser.value?.role === 'admin')
  const isDm = computed(() => appUser.value?.role === 'dm')
  const role = computed(() => appUser.value?.role || 'player')

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

  return { firebaseUser, appUser, loading, isAuthenticated, isAdmin, isDm, role, init, logout }
})

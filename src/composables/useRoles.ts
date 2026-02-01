import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useRoles() {
  const auth = useAuthStore()

  return {
    isAdmin: computed(() => auth.isAdmin),
    isDm: computed(() => auth.isDm),
    role: computed(() => auth.role),
  }
}

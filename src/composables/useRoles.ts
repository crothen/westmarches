import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import type { UserRole } from '../types'

export function useRoles() {
  const auth = useAuthStore()

  return {
    isAdmin: computed(() => auth.isAdmin),
    isDm: computed(() => auth.isDm),
    isPlayer: computed(() => auth.isPlayer),
    roles: computed(() => auth.roles),
    primaryRole: computed(() => auth.primaryRole),
    /** @deprecated Use `roles` or `primaryRole` */
    role: computed(() => auth.role),
    hasRole: (r: UserRole) => auth.hasRole(r),
  }
}

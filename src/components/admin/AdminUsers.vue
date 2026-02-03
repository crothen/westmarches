<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuthStore } from '../../stores/auth'
import type { UserRole } from '../../types'

interface UserRecord {
  uid: string
  email: string
  displayName: string
  roles: UserRole[]
  role?: string
  createdAt: any
}

const ALL_ROLES: UserRole[] = ['player', 'dm', 'admin']
const auth = useAuthStore()
const users = ref<UserRecord[]>([])
const loading = ref(true)
const searchQuery = ref('')
const savingUid = ref<string | null>(null)
const savedUid = ref<string | null>(null)

let _unsub: (() => void) | null = null

onMounted(() => {
  _unsub = onSnapshot(query(collection(db, 'users'), orderBy('displayName', 'asc')), (snap) => {
    users.value = snap.docs.map(d => {
      const data = d.data() as any
      const roles: UserRole[] = data.roles || (data.role ? [data.role] : ['player'])
      return { uid: d.id, ...data, roles } as UserRecord
    })
    loading.value = false
  }, (e) => {
    console.error('Failed to load users:', e)
    loading.value = false
  })
})

onUnmounted(() => _unsub?.())

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u =>
    u.displayName?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q) ||
    u.roles?.some(r => r.toLowerCase().includes(q))
  )
})

async function toggleRole(user: UserRecord, role: UserRole) {
  const hasRole = user.roles.includes(role)
  if (hasRole && role === 'admin' && user.uid === auth.firebaseUser?.uid) {
    if (!confirm('You are about to remove your own admin access. Are you sure?')) return
  }
  if (hasRole && user.roles.length <= 1) return

  const newRoles = hasRole ? user.roles.filter(r => r !== role) : [...user.roles, role]
  savingUid.value = user.uid
  try {
    await updateDoc(doc(db, 'users', user.uid), { roles: newRoles })
    user.roles = newRoles
    savedUid.value = user.uid
    setTimeout(() => { if (savedUid.value === user.uid) savedUid.value = null }, 2000)
  } catch (e) {
    console.error('Failed to update roles:', e)
    alert('Failed to update roles.')
  } finally {
    savingUid.value = null
  }
}

const deletingUid = ref<string | null>(null)

async function deleteUser(user: UserRecord) {
  if (user.uid === auth.firebaseUser?.uid) {
    alert("You can't delete your own account.")
    return
  }
  if (!confirm(`Delete user "${user.displayName || user.email}"? This removes their profile from the app.`)) return
  deletingUid.value = user.uid
  try {
    await deleteDoc(doc(db, 'users', user.uid))
  } catch (e) {
    console.error('Failed to delete user:', e)
    alert('Failed to delete user.')
  } finally {
    deletingUid.value = null
  }
}

function formatDate(date: any): string {
  if (!date) return '—'
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin': return 'bg-[#ef233c]/15 text-[#ef233c]'
    case 'dm': return 'bg-purple-500/15 text-purple-400'
    default: return 'bg-white/5 text-zinc-400'
  }
}

function getRoleToggleClass(role: string, active: boolean): string {
  if (!active) return 'bg-white/5 text-zinc-600 hover:bg-white/10 hover:text-zinc-400'
  switch (role) {
    case 'admin': return 'bg-[#ef233c]/20 text-[#ef233c] ring-1 ring-[#ef233c]/30'
    case 'dm': return 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30'
    default: return 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
  }
}
</script>

<template>
  <div>
    <input v-model="searchQuery" type="text" placeholder="Search users..." class="input w-full max-w-md mb-4" />

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading users...</div>

    <!-- Desktop table -->
    <div v-else class="card relative z-10 overflow-hidden hidden md:block">
      <div class="relative z-10">
        <div class="grid grid-cols-[1fr_1fr_1fr_100px_40px] gap-4 px-5 py-3 border-b border-white/[0.06] text-zinc-600">
          <span class="label">Name</span>
          <span class="label">Email</span>
          <span class="label">Roles</span>
          <span class="label">Joined</span>
          <span></span>
        </div>
        <div v-if="filteredUsers.length === 0" class="px-5 py-8 text-center text-zinc-600">No users found.</div>
        <div
          v-for="user in filteredUsers" :key="user.uid"
          class="grid grid-cols-[1fr_1fr_1fr_100px_40px] gap-4 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
        >
          <div>
            <span class="text-sm text-zinc-200 font-medium">{{ user.displayName || 'Unnamed' }}</span>
            <span v-if="user.uid === auth.firebaseUser?.uid" class="text-[0.6rem] text-zinc-600 ml-1.5">(you)</span>
          </div>
          <span class="text-sm text-zinc-500 truncate">{{ user.email || '—' }}</span>
          <div class="flex gap-1.5">
            <button
              v-for="r in ALL_ROLES" :key="r"
              :class="['text-[0.65rem] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider transition-all cursor-pointer', getRoleToggleClass(r, user.roles.includes(r))]"
              :disabled="savingUid === user.uid"
              @click="toggleRole(user, r)"
            >{{ r }}</button>
            <transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-from-class="opacity-100" leave-to-class="opacity-0">
              <span v-if="savedUid === user.uid" class="text-green-400 text-xs self-center ml-1">✓</span>
            </transition>
          </div>
          <span class="text-xs text-zinc-600">{{ formatDate(user.createdAt) }}</span>
          <button
            v-if="user.uid !== auth.firebaseUser?.uid"
            @click="deleteUser(user)"
            :disabled="deletingUid === user.uid"
            class="text-zinc-600 hover:text-red-400 text-base transition-colors justify-self-center"
            title="Delete user"
          >
            <span v-if="deletingUid === user.uid" class="inline-block w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin"></span>
            <span v-else>🗑️</span>
          </button>
          <span v-else></span>
        </div>
      </div>
    </div>

    <!-- Mobile cards -->
    <div class="md:hidden space-y-2">
      <div v-if="loading" class="text-zinc-500 animate-pulse">Loading users...</div>
      <div v-else-if="filteredUsers.length === 0" class="px-5 py-8 text-center text-zinc-600">No users found.</div>
      <div v-for="user in filteredUsers" :key="'m-'+user.uid" class="card-flat p-4">
        <div class="flex items-center justify-between mb-2">
          <div>
            <span class="text-sm text-zinc-200 font-medium">{{ user.displayName || 'Unnamed' }}</span>
            <span v-if="user.uid === auth.firebaseUser?.uid" class="text-[0.6rem] text-zinc-600 ml-1">(you)</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex gap-1">
              <span v-for="r in user.roles" :key="r" :class="['badge', getRoleBadgeClass(r)]">{{ r }}</span>
            </div>
            <button
              v-if="user.uid !== auth.firebaseUser?.uid"
              @click="deleteUser(user)"
              :disabled="deletingUid === user.uid"
              class="text-zinc-600 hover:text-red-400 text-base transition-colors"
              title="Delete user"
            >
              <span v-if="deletingUid === user.uid" class="inline-block w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin"></span>
              <span v-else>🗑️</span>
            </button>
          </div>
        </div>
        <div class="text-xs text-zinc-600 mb-3">{{ user.email }}</div>
        <div class="flex gap-1.5">
          <button
            v-for="r in ALL_ROLES" :key="r"
            :class="['text-[0.65rem] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider transition-all cursor-pointer', getRoleToggleClass(r, user.roles.includes(r))]"
            :disabled="savingUid === user.uid"
            @click="toggleRole(user, r)"
          >{{ r }}</button>
        </div>
      </div>
    </div>

    <!-- Role Legend -->
    <div class="card-flat p-4 mt-6">
      <h3 class="label mb-3">Role Permissions</h3>
      <div class="space-y-2 text-sm">
        <div class="flex items-start gap-3">
          <span :class="['badge shrink-0', getRoleBadgeClass('player')]">Player</span>
          <span class="text-zinc-500">View content, edit own character, edit NPCs, add notes, vote on missions</span>
        </div>
        <div class="flex items-start gap-3">
          <span :class="['badge shrink-0', getRoleBadgeClass('dm')]">DM</span>
          <span class="text-zinc-500">Everything a player can do + manage sessions, missions, map editing</span>
        </div>
        <div class="flex items-start gap-3">
          <span :class="['badge shrink-0', getRoleBadgeClass('admin')]">Admin</span>
          <span class="text-zinc-500">Full system access: manage users, roles, configuration</span>
        </div>
      </div>
    </div>
  </div>
</template>

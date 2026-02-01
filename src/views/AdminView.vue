<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'

interface UserRecord {
  uid: string
  email: string
  displayName: string
  role: string
  createdAt: any
}

const auth = useAuthStore()
const users = ref<UserRecord[]>([])
const loading = ref(true)
const searchQuery = ref('')
const savingUid = ref<string | null>(null)
const savedUid = ref<string | null>(null)

onMounted(async () => {
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('displayName', 'asc')))
    users.value = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserRecord))
  } catch (e) {
    console.error('Failed to load users:', e)
  } finally {
    loading.value = false
  }
})

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u =>
    u.displayName?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q) ||
    u.role?.toLowerCase().includes(q)
  )
})

async function changeRole(user: UserRecord, newRole: string) {
  if (newRole === user.role) return
  if (user.uid === auth.firebaseUser?.uid && newRole !== 'admin') {
    if (!confirm('You are about to remove your own admin access. Are you sure?')) return
  }
  
  savingUid.value = user.uid
  try {
    await updateDoc(doc(db, 'users', user.uid), { role: newRole })
    user.role = newRole
    savedUid.value = user.uid
    setTimeout(() => { if (savedUid.value === user.uid) savedUid.value = null }, 2000)
  } catch (e) {
    console.error('Failed to update role:', e)
    alert('Failed to update role. Make sure you have admin permissions.')
  } finally {
    savingUid.value = null
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
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">⚙️ Admin Panel</h1>
      <span class="text-zinc-600 text-sm">{{ users.length }} users</span>
    </div>

    <!-- User Management Section -->
    <div class="mb-8">
      <h2 class="label mb-4">User Management</h2>

      <input v-model="searchQuery" type="text" placeholder="Search users..." class="input w-full max-w-md mb-4" />

      <div v-if="loading" class="text-zinc-500 animate-pulse">Loading users...</div>

      <div v-else class="card relative z-10 overflow-hidden hidden md:block">
        <div class="relative z-10">
          <!-- Table header -->
          <div class="grid grid-cols-[1fr_1fr_140px_100px] gap-4 px-5 py-3 border-b border-white/[0.06] text-zinc-600">
            <span class="label">Name</span>
            <span class="label">Email</span>
            <span class="label">Role</span>
            <span class="label">Joined</span>
          </div>

          <!-- User rows -->
          <div v-if="filteredUsers.length === 0" class="px-5 py-8 text-center text-zinc-600">No users found.</div>

          <div
            v-for="user in filteredUsers" :key="user.uid"
            class="grid grid-cols-[1fr_1fr_140px_100px] gap-4 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
          >
            <div>
              <span class="text-sm text-zinc-200 font-medium">{{ user.displayName || 'Unnamed' }}</span>
              <span v-if="user.uid === auth.firebaseUser?.uid" class="text-[0.6rem] text-zinc-600 ml-1.5">(you)</span>
            </div>
            <span class="text-sm text-zinc-500 truncate">{{ user.email || '—' }}</span>
            <div class="relative">
              <select
                :value="user.role || 'player'"
                @change="(e: any) => changeRole(user, e.target.value)"
                :disabled="savingUid === user.uid"
                class="input !py-1 !text-xs w-full"
              >
                <option value="player">Player</option>
                <option value="dm">DM</option>
                <option value="admin">Admin</option>
              </select>
              <transition
                enter-active-class="transition-opacity duration-200"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition-opacity duration-200"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <span v-if="savedUid === user.uid" class="absolute -right-6 top-1/2 -translate-y-1/2 text-green-400 text-xs">✓</span>
              </transition>
            </div>
            <span class="text-xs text-zinc-600">{{ formatDate(user.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Mobile-friendly card view for small screens -->
      <div class="md:hidden space-y-2">
        <div v-if="loading" class="text-zinc-500 animate-pulse">Loading users...</div>
        <div v-else-if="filteredUsers.length === 0" class="px-5 py-8 text-center text-zinc-600">No users found.</div>
        <div v-for="user in filteredUsers" :key="'m-'+user.uid" class="card-flat p-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <span class="text-sm text-zinc-200 font-medium">{{ user.displayName || 'Unnamed' }}</span>
              <span v-if="user.uid === auth.firebaseUser?.uid" class="text-[0.6rem] text-zinc-600 ml-1">(you)</span>
            </div>
            <span :class="['badge', getRoleBadgeClass(user.role)]">{{ user.role || 'player' }}</span>
          </div>
          <div class="text-xs text-zinc-600 mb-2">{{ user.email }}</div>
          <select
            :value="user.role || 'player'"
            @change="(e: any) => changeRole(user, e.target.value)"
            class="input !py-1 !text-xs w-full"
          >
            <option value="player">Player</option>
            <option value="dm">DM</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Role Legend -->
    <div class="card-flat p-4">
      <h3 class="label mb-3">Role Permissions</h3>
      <div class="space-y-2 text-sm">
        <div class="flex items-start gap-3">
          <span :class="['badge shrink-0', getRoleBadgeClass('player')]">Player</span>
          <span class="text-zinc-500">View content, edit own character, add notes, vote on missions, sign up for sessions</span>
        </div>
        <div class="flex items-start gap-3">
          <span :class="['badge shrink-0', getRoleBadgeClass('dm')]">DM</span>
          <span class="text-zinc-500">Everything a player can do + manage sessions, missions, map editing, see private notes</span>
        </div>
        <div class="flex items-start gap-3">
          <span :class="['badge shrink-0', getRoleBadgeClass('admin')]">Admin</span>
          <span class="text-zinc-500">Manage users and roles, system configuration. Cannot see DM-private content.</span>
        </div>
      </div>
    </div>
  </div>
</template>

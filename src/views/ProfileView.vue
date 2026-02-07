<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { changePassword, isEmailUser } from '../firebase/auth'

const auth = useAuthStore()

const _unsubs: (() => void)[] = []

onMounted(() => {
  if (auth.firebaseUser) {
    _unsubs.push(onSnapshot(
      doc(db, 'users', auth.firebaseUser.uid),
      () => {} // auth store already handles this
    ))
  }
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

// Display name editing
const editingName = ref(false)
const newDisplayName = ref('')
const savingName = ref(false)

function startEditName() {
  newDisplayName.value = auth.appUser?.displayName || ''
  editingName.value = true
}

async function saveName() {
  if (!newDisplayName.value.trim() || !auth.firebaseUser) return
  savingName.value = true
  try {
    await updateDoc(doc(db, 'users', auth.firebaseUser.uid), {
      displayName: newDisplayName.value.trim(),
    })
    if (auth.appUser) auth.appUser.displayName = newDisplayName.value.trim()
    editingName.value = false
  } catch (e) {
    console.error('Failed to update name:', e)
    alert('Failed to save display name.')
  } finally {
    savingName.value = false
  }
}

// Discord username linking
const editingDiscord = ref(false)
const newDiscordUsername = ref('')
const savingDiscord = ref(false)

function startEditDiscord() {
  newDiscordUsername.value = auth.appUser?.discordUsername || ''
  editingDiscord.value = true
}

async function saveDiscord() {
  if (!auth.firebaseUser) return
  savingDiscord.value = true
  try {
    const discordUsername = newDiscordUsername.value.trim() || null
    await updateDoc(doc(db, 'users', auth.firebaseUser.uid), { discordUsername })
    if (auth.appUser) (auth.appUser as any).discordUsername = discordUsername
    editingDiscord.value = false
  } catch (e) {
    console.error('Failed to update Discord username:', e)
    alert('Failed to save Discord username.')
  } finally {
    savingDiscord.value = false
  }
}

// Password change
const isEmail = computed(() => isEmailUser())
const showPasswordForm = ref(false)
const currentPw = ref('')
const newPw = ref('')
const confirmPw = ref('')
const pwError = ref('')
const pwSuccess = ref(false)
const changingPw = ref(false)

async function handleChangePassword() {
  pwError.value = ''
  pwSuccess.value = false

  if (newPw.value.length < 6) {
    pwError.value = 'New password must be at least 6 characters.'
    return
  }
  if (newPw.value !== confirmPw.value) {
    pwError.value = 'Passwords do not match.'
    return
  }

  changingPw.value = true
  try {
    await changePassword(currentPw.value, newPw.value)
    pwSuccess.value = true
    currentPw.value = ''
    newPw.value = ''
    confirmPw.value = ''
    showPasswordForm.value = false
  } catch (e: any) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      pwError.value = 'Current password is incorrect.'
    } else {
      pwError.value = e.message || 'Failed to change password.'
    }
  } finally {
    changingPw.value = false
  }
}

const providerName = computed(() => {
  const user = auth.firebaseUser
  if (!user) return ''
  if (user.isAnonymous) return 'Guest'
  const providers = user.providerData.map(p => {
    if (p.providerId === 'password') return 'Email/Password'
    if (p.providerId === 'google.com') return 'Google'
    return p.providerId
  })
  return providers.join(', ') || 'Unknown'
})

const memberSince = computed(() => {
  const d = auth.appUser?.createdAt
  if (!d) return ''
  const date = (d as any)?.toDate ? (d as any).toDate() : new Date(d)
  return date.toLocaleDateString()
})
</script>

<template>
  <div class="max-w-xl mx-auto">
    <h1 class="text-2xl font-bold tracking-tight text-white mb-6" style="font-family: Manrope, sans-serif">👤 Profile</h1>

    <div class="card relative z-10 p-6">
      <div class="relative z-10 space-y-5">
        <!-- Display Name -->
        <div>
          <label class="label text-xs mb-1">Display Name</label>
          <div v-if="!editingName" class="flex items-center gap-3">
            <span class="text-lg text-white font-medium">{{ auth.appUser?.displayName || 'Adventurer' }}</span>
            <button @click="startEditName" class="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">✏️ Edit</button>
          </div>
          <div v-else class="flex items-center gap-2">
            <input v-model="newDisplayName" class="input flex-1" @keyup.enter="saveName" />
            <button @click="saveName" :disabled="savingName || !newDisplayName.trim()" class="btn !text-xs flex items-center gap-1.5">
              <span v-if="savingName" class="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Save
            </button>
            <button @click="editingName = false" class="btn !bg-white/5 !text-zinc-400 !text-xs">Cancel</button>
          </div>
        </div>

        <!-- Email -->
        <div v-if="auth.firebaseUser?.email">
          <label class="label text-xs mb-1">Email</label>
          <span class="text-zinc-400">{{ auth.firebaseUser.email }}</span>
        </div>

        <!-- Sign-in Method -->
        <div>
          <label class="label text-xs mb-1">Sign-in Method</label>
          <span class="text-zinc-400">{{ providerName }}</span>
        </div>

        <!-- Roles -->
        <div>
          <label class="label text-xs mb-1">Roles</label>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="r in auth.roles" :key="r" class="text-[0.65rem] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest" :class="r === 'admin' ? 'bg-[#ef233c]/10 text-[#ef233c]' : r === 'dm' ? 'bg-purple-500/10 text-purple-400' : 'bg-white/5 text-zinc-400'" style="font-family: Manrope, sans-serif">{{ r }}</span>
          </div>
        </div>

        <!-- Member Since -->
        <div v-if="memberSince">
          <label class="label text-xs mb-1">Member Since</label>
          <span class="text-zinc-400">{{ memberSince }}</span>
        </div>

        <!-- Discord Username -->
        <div>
          <label class="label text-xs mb-1">Discord <span class="text-zinc-600 font-normal">(for notifications)</span></label>
          <div v-if="!editingDiscord" class="flex items-center gap-3">
            <span v-if="auth.appUser?.discordUsername" class="text-zinc-400 text-sm">{{ auth.appUser.discordUsername }}</span>
            <span v-else class="text-zinc-600 text-sm">Not linked</span>
            <button @click="startEditDiscord" class="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">{{ auth.appUser?.discordUsername ? '✏️ Edit' : '🔗 Link' }}</button>
          </div>
          <div v-else class="space-y-2">
            <input v-model="newDiscordUsername" class="input w-full text-sm" placeholder="Your Discord username (e.g. chrigugigu)" @keyup.enter="saveDiscord" />
            <p class="text-xs text-zinc-600">Enter your Discord username — you'll be tagged in session notifications</p>
            <div class="flex items-center gap-2">
              <button @click="saveDiscord" :disabled="savingDiscord" class="btn !text-xs flex items-center gap-1.5">
                <span v-if="savingDiscord" class="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Save
              </button>
              <button @click="editingDiscord = false" class="btn !bg-white/5 !text-zinc-400 !text-xs">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Change Password Section -->
    <div v-if="isEmail" class="card relative z-10 p-6 mt-4">
      <div class="relative z-10">
        <h2 class="text-lg font-semibold text-zinc-200 mb-4" style="font-family: Manrope, sans-serif">🔒 Change Password</h2>

        <div v-if="pwSuccess" class="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg p-3 mb-4 text-sm">
          Password changed successfully!
        </div>

        <div v-if="!showPasswordForm">
          <button @click="showPasswordForm = true; pwSuccess = false" class="btn !text-sm">Change Password</button>
        </div>

        <div v-else class="space-y-3">
          <div v-if="pwError" class="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm">{{ pwError }}</div>

          <div>
            <label class="label text-xs mb-1">Current Password</label>
            <input v-model="currentPw" type="password" class="input w-full" />
          </div>
          <div>
            <label class="label text-xs mb-1">New Password</label>
            <input v-model="newPw" type="password" class="input w-full" placeholder="At least 6 characters" />
          </div>
          <div>
            <label class="label text-xs mb-1">Confirm New Password</label>
            <input v-model="confirmPw" type="password" class="input w-full" @keyup.enter="handleChangePassword" />
          </div>
          <div class="flex gap-2">
            <button @click="handleChangePassword" :disabled="changingPw || !currentPw || !newPw || !confirmPw" class="btn !text-sm flex items-center gap-1.5">
              <span v-if="changingPw" class="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {{ changingPw ? 'Changing...' : 'Update Password' }}
            </button>
            <button @click="showPasswordForm = false; pwError = ''" class="btn !bg-white/5 !text-zinc-400 !text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

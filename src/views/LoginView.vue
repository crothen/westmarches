<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { signInWithEmail, signInWithGoogle, signInAnonymously } from '../firebase/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleEmailLogin() {
  loading.value = true; error.value = ''
  try { await signInWithEmail(email.value, password.value); router.push('/') }
  catch (e: any) { error.value = e.message }
  finally { loading.value = false }
}

async function handleGoogleLogin() {
  loading.value = true; error.value = ''
  try { await signInWithGoogle(); router.push('/') }
  catch (e: any) { error.value = e.message }
  finally { loading.value = false }
}

async function handleGuestBrowse() {
  loading.value = true; error.value = ''
  try { await signInAnonymously(); router.push('/') }
  catch (e: any) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-24">
    <div class="text-center mb-8">
      <div class="w-6 h-6 bg-[#ef233c] rounded-sm rotate-45 mx-auto mb-5"></div>
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">Enter the West Marches</h1>
    </div>

    <div class="card p-6 relative z-10">
      <div class="relative z-10">
        <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-4 text-sm">{{ error }}</div>

        <form @submit.prevent="handleEmailLogin" class="space-y-3">
          <div>
            <label class="label block mb-1.5">Email</label>
            <input v-model="email" type="email" required class="input w-full" />
          </div>
          <div>
            <label class="label block mb-1.5">Password</label>
            <input v-model="password" type="password" required class="input w-full" />
          </div>
          <button type="submit" :disabled="loading" class="btn w-full !py-2.5 mt-1">{{ loading ? 'Signing in...' : 'Sign In' }}</button>
        </form>

        <div class="my-5 flex items-center gap-3">
          <div class="flex-1 border-t border-white/[0.06]" />
          <span class="text-zinc-700 text-[0.65rem] uppercase tracking-widest font-semibold" style="font-family: Manrope">or</span>
          <div class="flex-1 border-t border-white/[0.06]" />
        </div>

        <button @click="handleGoogleLogin" :disabled="loading" class="btn-ghost w-full flex items-center justify-center gap-2 !py-2.5">
          <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>

        <div class="my-5 flex items-center gap-3">
          <div class="flex-1 border-t border-white/[0.06]" />
          <span class="text-zinc-700 text-[0.65rem] uppercase tracking-widest font-semibold" style="font-family: Manrope">or</span>
          <div class="flex-1 border-t border-white/[0.06]" />
        </div>

        <button @click="handleGuestBrowse" :disabled="loading" class="btn-ghost w-full flex items-center justify-center gap-2 !py-2.5 !text-zinc-400">
          👁️ Browse as Guest
        </button>

        <p class="text-center text-zinc-600 text-sm mt-5">
          New adventurer? <RouterLink to="/register" class="text-[#ef233c] hover:text-red-400 transition-colors">Register</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { registerWithEmail } from '../firebase/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await registerWithEmail(email.value, password.value)
    router.push('/')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-20">
    <div class="text-center mb-8">
      <div class="text-4xl mb-3">📜</div>
      <h1 class="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">Join the Expedition</h1>
    </div>

    <div class="glass-card p-6">
      <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-4 text-sm">
        {{ error }}
      </div>

      <form @submit.prevent="handleRegister" class="space-y-3">
        <div>
          <label class="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">Email</label>
          <input v-model="email" type="email" required class="modern-input w-full" />
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">Password</label>
          <input v-model="password" type="password" required minlength="6" class="modern-input w-full" />
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">Confirm Password</label>
          <input v-model="confirmPassword" type="password" required class="modern-input w-full" />
        </div>
        <button type="submit" :disabled="loading" class="btn-primary w-full !py-2.5 mt-1">
          {{ loading ? 'Registering...' : 'Register' }}
        </button>
      </form>

      <p class="text-center text-slate-600 text-sm mt-5">
        Already registered? <RouterLink to="/login" class="text-amber-500 hover:text-amber-400 transition-colors">Sign In</RouterLink>
      </p>
    </div>
  </div>
</template>

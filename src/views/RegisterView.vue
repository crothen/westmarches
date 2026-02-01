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
  <div class="max-w-md mx-auto mt-20">
    <div class="bg-stone-800 rounded-lg border border-stone-700 p-8">
      <h1 class="text-2xl font-bold text-amber-500 mb-6 text-center">📜 Join the Expedition</h1>

      <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded p-3 mb-4 text-sm">
        {{ error }}
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-stone-400 text-sm mb-1">Email</label>
          <input v-model="email" type="email" required class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Password</label>
          <input v-model="password" type="password" required minlength="6" class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-stone-400 text-sm mb-1">Confirm Password</label>
          <input v-model="confirmPassword" type="password" required class="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-stone-100 focus:border-amber-500 focus:outline-none" />
        </div>
        <button type="submit" :disabled="loading" class="w-full bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold py-2 rounded transition-colors disabled:opacity-50">
          {{ loading ? 'Registering...' : 'Register' }}
        </button>
      </form>

      <p class="text-center text-stone-500 text-sm mt-6">
        Already registered? <RouterLink to="/login" class="text-amber-500 hover:text-amber-400">Sign In</RouterLink>
      </p>
    </div>
  </div>
</template>

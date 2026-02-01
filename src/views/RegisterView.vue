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
  loading.value = true; error.value = ''
  try { await registerWithEmail(email.value, password.value); router.push('/') }
  catch (e: any) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-24">
    <div class="text-center mb-8">
      <div class="w-6 h-6 bg-[#ef233c] rounded-sm rotate-45 mx-auto mb-5"></div>
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">Join the Expedition</h1>
    </div>

    <div class="card p-6 relative z-10">
      <div class="relative z-10">
        <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-4 text-sm">{{ error }}</div>

        <form @submit.prevent="handleRegister" class="space-y-3">
          <div>
            <label class="label block mb-1.5">Email</label>
            <input v-model="email" type="email" required class="input w-full" />
          </div>
          <div>
            <label class="label block mb-1.5">Password</label>
            <input v-model="password" type="password" required minlength="6" class="input w-full" />
          </div>
          <div>
            <label class="label block mb-1.5">Confirm Password</label>
            <input v-model="confirmPassword" type="password" required class="input w-full" />
          </div>
          <button type="submit" :disabled="loading" class="btn w-full !py-2.5 mt-1">{{ loading ? 'Registering...' : 'Register' }}</button>
        </form>

        <p class="text-center text-zinc-600 text-sm mt-5">
          Already registered? <RouterLink to="/login" class="text-[#ef233c] hover:text-red-400 transition-colors">Sign In</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

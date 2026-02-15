<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getAuth } from 'firebase/auth'

const router = useRouter()
const authStore = useAuthStore()
const wcLoaded = ref(false)
const wcError = ref<string | null>(null)
const authToken = ref<string | null>(null)

// Get Firebase auth token for the web component
async function getToken() {
  const user = getAuth().currentUser
  if (user) {
    try {
      authToken.value = await user.getIdToken()
    } catch (e) {
      console.error('Failed to get auth token:', e)
    }
  }
}

onMounted(async () => {
  await getToken()
  
  // Check if wm-map is already defined
  if (customElements.get('wm-map')) {
    wcLoaded.value = true
    return
  }
  
  // Try to load the web component script
  try {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/wc/westmarches.js'
    script.onload = () => {
      wcLoaded.value = true
    }
    script.onerror = () => {
      wcError.value = 'Failed to load web component. Run `cd wc && npm run build` first.'
    }
    document.head.appendChild(script)
    
    // Timeout fallback
    setTimeout(() => {
      if (!wcLoaded.value && !wcError.value) {
        wcError.value = 'Web component script not found. Build the wc package first.'
      }
    }, 3000)
  } catch (e) {
    wcError.value = `Error loading web component: ${e}`
  }
})

function goBack() {
  router.push({ name: 'map' })
}
</script>

<template>
  <div class="fixed inset-0 bg-black flex flex-col z-50">
    <!-- Top bar -->
    <div class="flex items-center justify-between p-3 border-b border-zinc-800">
      <div class="flex items-center gap-3">
        <button 
          @click="goBack"
          class="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>←</span>
          <span>Back to Map</span>
        </button>
        <h1 class="text-xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">
          🧪 Web Component Test
        </h1>
        <span class="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">wm-map</span>
      </div>
    </div>

    <!-- Content area - 90% height -->
    <div class="flex-1 p-4 overflow-hidden" style="height: 90vh;">
      <!-- Loading state -->
      <div v-if="!wcLoaded && !wcError" class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="w-6 h-6 border-2 border-[#ef233c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div class="text-zinc-400">Loading web component...</div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="wcError" class="h-full flex items-center justify-center">
        <div class="text-center max-w-md">
          <div class="text-4xl mb-4">⚠️</div>
          <div class="text-red-400 mb-4">{{ wcError }}</div>
          <div class="text-zinc-500 text-sm mb-6">
            The web component needs to be built separately:
          </div>
          <pre class="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-left text-sm text-zinc-300 font-mono">cd wc
npm install
npm run build</pre>
        </div>
      </div>

      <!-- Web component -->
      <div v-else-if="authToken" class="h-full rounded-xl overflow-hidden border border-zinc-800">
        <wm-map
          :authToken.prop="authToken"
          :userId.prop="authStore.firebaseUser?.uid || ''"
          :userName.prop="authStore.appUser?.displayName || 'Anonymous'"
          :isAdmin.prop="authStore.isAdmin"
          :isDm.prop="authStore.isDm"
        ></wm-map>
      </div>
      
      <!-- Waiting for auth -->
      <div v-else class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="w-6 h-6 border-2 border-[#ef233c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div class="text-zinc-400">Authenticating...</div>
        </div>
      </div>
    </div>
  </div>
</template>

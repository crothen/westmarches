<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

interface CampaignConfig {
  startDate?: string  // YYYY-MM-DD
}

const config = ref<CampaignConfig>({})
const loading = ref(true)
const saving = ref(false)
const editStartDate = ref('')
let unsub: (() => void) | null = null

onMounted(() => {
  unsub = onSnapshot(doc(db, 'config', 'campaign'), (snap) => {
    if (snap.exists()) {
      config.value = snap.data() as CampaignConfig
      editStartDate.value = config.value.startDate || ''
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load campaign config:', e)
    loading.value = false
  })
})

onUnmounted(() => unsub?.())

async function save() {
  saving.value = true
  try {
    await setDoc(doc(db, 'config', 'campaign'), {
      startDate: editStartDate.value || null,
    }, { merge: true })
  } catch (e) {
    console.error('Failed to save config:', e)
    alert('Failed to save: ' + (e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/admin" class="text-zinc-500 hover:text-white transition-colors">← Admin</RouterLink>
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">🎲 Campaign Settings</h1>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else class="card p-6 max-w-xl">
      <div class="relative z-10 space-y-4">
        <div>
          <label class="label block mb-1.5">Campaign Start Date (In-Game)</label>
          <input v-model="editStartDate" type="date" class="input w-full" />
          <p class="text-xs text-zinc-600 mt-1">The in-game date when the campaign begins. Used for the calendar view.</p>
        </div>

        <div class="pt-2">
          <button @click="save" :disabled="saving" class="btn">
            <span v-if="saving" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

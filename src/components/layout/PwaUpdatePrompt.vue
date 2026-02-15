<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
// @ts-ignore - virtual module from vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/vue'

const UPDATED_AT_KEY = 'pwa-updated-at'
const SUPPRESS_DURATION_MS = 60 * 60 * 1000 // 1 hour - don't show update prompt again within this period

const showPrompt = ref(false)
const isUpdating = ref(false)
const dismissed = ref(false)
const suppressed = ref(false)

// Check if we recently updated (within suppression period)
onMounted(() => {
  const updatedAt = localStorage.getItem(UPDATED_AT_KEY)
  if (updatedAt) {
    const elapsed = Date.now() - parseInt(updatedAt, 10)
    if (elapsed < SUPPRESS_DURATION_MS) {
      suppressed.value = true
    } else {
      localStorage.removeItem(UPDATED_AT_KEY)
    }
  }
})

const {
  needRefresh,
  updateServiceWorker
} = useRegisterSW({
  onRegisteredSW(_swUrl: string, r: ServiceWorkerRegistration | undefined) {
    // Check for updates every 5 minutes
    if (r) {
      setInterval(() => {
        r.update()
      }, 5 * 60 * 1000)
    }
  },
  onRegisterError(_error: Error) {
    // Silent fail
  }
})

// Show prompt when update is available (unless dismissed or suppressed)
watch(needRefresh, (needsRefresh) => {
  if (needsRefresh && !dismissed.value && !suppressed.value) {
    showPrompt.value = true
  }
}, { immediate: true })

async function handleUpdate() {
  if (isUpdating.value) return
  isUpdating.value = true
  showPrompt.value = false
  
  // Mark that we're updating - suppress prompts for 1 hour
  localStorage.setItem(UPDATED_AT_KEY, Date.now().toString())
  
  // Reset needRefresh to prevent re-showing
  needRefresh.value = false
  
  try {
    await updateServiceWorker(true)
    // updateServiceWorker(true) should reload, but give it a moment
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } catch (e) {
    console.error('Update failed:', e)
    window.location.reload()
  }
}

function dismiss() {
  showPrompt.value = false
  dismissed.value = true
  // Also suppress for 1 hour when dismissed
  localStorage.setItem(UPDATED_AT_KEY, Date.now().toString())
  needRefresh.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="showPrompt" class="pwa-update-overlay" @click.self="dismiss">
        <div class="pwa-update-sheet">
          <div class="pwa-update-handle"></div>
          <div class="pwa-update-icon">✨</div>
          <div class="pwa-update-title">Update Available</div>
          <div class="pwa-update-desc">A new version is ready. Update now to get the latest features and fixes.</div>
          <div class="pwa-update-actions">
            <button @click="dismiss" class="pwa-update-btn secondary" :disabled="isUpdating">
              Later
            </button>
            <button @click="handleUpdate" class="pwa-update-btn primary" :disabled="isUpdating">
              <span v-if="isUpdating" class="pwa-update-spinner"></span>
              <span v-else>Update Now</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pwa-update-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.pwa-update-sheet {
  width: 100%;
  max-width: 400px;
  background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px 24px 0 0;
  padding: 12px 24px calc(24px + env(safe-area-inset-bottom, 0px));
  text-align: center;
}

.pwa-update-handle {
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: 0 auto 20px;
}

.pwa-update-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.pwa-update-title {
  font-size: 20px;
  font-weight: 700;
  color: white;
  margin-bottom: 8px;
}

.pwa-update-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
  margin-bottom: 24px;
}

.pwa-update-actions {
  display: flex;
  gap: 12px;
}

.pwa-update-btn {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.pwa-update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pwa-update-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.pwa-update-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.pwa-update-btn.primary {
  background: #ef233c;
  color: white;
  box-shadow: 0 4px 16px rgba(239, 35, 60, 0.4);
}

.pwa-update-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-active .pwa-update-sheet,
.slide-up-leave-active .pwa-update-sheet {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  background: rgba(0, 0, 0, 0);
}

.slide-up-enter-from .pwa-update-sheet,
.slide-up-leave-to .pwa-update-sheet {
  transform: translateY(100%);
}
</style>

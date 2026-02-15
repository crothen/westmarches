<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
// @ts-ignore - virtual module from vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/vue'

const JUST_UPDATED_KEY = 'pwa-just-updated'
const COOLDOWN_MS = 10000 // 10 seconds cooldown after update

const showPrompt = ref(false)
const isUpdating = ref(false)
const dismissed = ref(false)
const inCooldown = ref(false)

// Check if we just updated (within cooldown period)
onMounted(() => {
  const justUpdatedAt = sessionStorage.getItem(JUST_UPDATED_KEY)
  if (justUpdatedAt) {
    const elapsed = Date.now() - parseInt(justUpdatedAt, 10)
    if (elapsed < COOLDOWN_MS) {
      inCooldown.value = true
      // Clear cooldown after remaining time
      setTimeout(() => {
        inCooldown.value = false
        sessionStorage.removeItem(JUST_UPDATED_KEY)
      }, COOLDOWN_MS - elapsed)
    } else {
      sessionStorage.removeItem(JUST_UPDATED_KEY)
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

// Show prompt when update is available (unless dismissed or in cooldown)
watch([needRefresh, inCooldown], ([needsRefresh, cooling]) => {
  if (needsRefresh && !dismissed.value && !cooling) {
    showPrompt.value = true
  }
}, { immediate: true })

async function handleUpdate() {
  if (isUpdating.value) return
  isUpdating.value = true
  
  // Mark that we're updating to prevent immediate re-trigger
  sessionStorage.setItem(JUST_UPDATED_KEY, Date.now().toString())
  
  try {
    await updateServiceWorker(true)
    // Force reload if updateServiceWorker doesn't trigger it
    setTimeout(() => {
      window.location.reload()
    }, 500)
  } catch (e) {
    console.error('Update failed:', e)
    // Fallback: force reload
    window.location.reload()
  }
}

function dismiss() {
  showPrompt.value = false
  dismissed.value = true
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

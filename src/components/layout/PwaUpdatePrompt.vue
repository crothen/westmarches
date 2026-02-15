<script setup lang="ts">
import { ref, onMounted } from 'vue'
// @ts-ignore - virtual module from vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/vue'

const showPrompt = ref(false)

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

// Show prompt when update is available
onMounted(() => {
  // Watch for changes
  const checkUpdate = () => {
    if (needRefresh.value) {
      showPrompt.value = true
    }
  }
  
  // Check immediately and set up interval
  checkUpdate()
  setInterval(checkUpdate, 1000)
})

async function handleUpdate() {
  showPrompt.value = false
  await updateServiceWorker(true)
}

function dismiss() {
  showPrompt.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="showPrompt || needRefresh" class="pwa-update-prompt">
        <div class="pwa-update-content">
          <div class="pwa-update-icon">✨</div>
          <div class="pwa-update-text">
            <div class="pwa-update-title">Update Available</div>
            <div class="pwa-update-desc">Tap to get the latest version</div>
          </div>
          <button @click="handleUpdate" class="pwa-update-btn">
            Update
          </button>
          <button @click="dismiss" class="pwa-update-close">
            ✕
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pwa-update-prompt {
  position: fixed;
  bottom: calc(100px + env(safe-area-inset-bottom, 0px));
  left: 16px;
  right: 16px;
  z-index: 9999;
}

.pwa-update-content {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
  border: 1px solid rgba(239, 35, 60, 0.3);
  border-radius: 16px;
  padding: 12px 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 35, 60, 0.2);
}

.pwa-update-icon {
  font-size: 24px;
}

.pwa-update-text {
  flex: 1;
}

.pwa-update-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.pwa-update-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

.pwa-update-btn {
  background: #ef233c;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}

.pwa-update-btn:active {
  transform: scale(0.95);
  background: #d91e36;
}

.pwa-update-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 16px;
  padding: 4px;
  cursor: pointer;
}

/* Animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>

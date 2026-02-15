<script setup lang="ts">
import { ref, onMounted } from 'vue'

const show = ref(true)
const fadeOut = ref(false)

onMounted(() => {
  // Minimum display time for splash
  setTimeout(() => {
    fadeOut.value = true
    setTimeout(() => {
      show.value = false
    }, 300)
  }, 800)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" :class="['pwa-splash', { 'fade-out': fadeOut }]">
      <div class="splash-content">
        <div class="splash-icon">
          <img src="/pwa-192x192.png" alt="West Marches" />
        </div>
        <h1 class="splash-title">West Marches</h1>
        <div class="splash-loader">
          <div class="loader-bar"></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pwa-splash {
  position: fixed;
  inset: 0;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  transition: opacity 0.3s ease-out;
}

.pwa-splash.fade-out {
  opacity: 0;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.splash-icon {
  width: 96px;
  height: 96px;
  animation: pulse 1.5s ease-in-out infinite;
}

.splash-icon img {
  width: 100%;
  height: 100%;
  border-radius: 20px;
}

.splash-title {
  font-size: 24px;
  font-weight: 700;
  color: white;
  letter-spacing: 0.05em;
  font-family: Manrope, sans-serif;
}

.splash-loader {
  width: 120px;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.loader-bar {
  height: 100%;
  width: 40%;
  background: #ef233c;
  border-radius: 3px;
  animation: loading 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes loading {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>

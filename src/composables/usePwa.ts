import { ref } from 'vue'

const isPwa = ref(false)
const isOnline = ref(navigator.onLine)
const canInstall = ref(false)
let deferredPrompt: any = null

// Check if running as installed PWA
function checkPwaMode() {
  isPwa.value = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://') ||
    window.location.search.includes('pwa=true')
}

// Initial check
checkPwaMode()

// Listen for display mode changes
const displayModeQuery = window.matchMedia('(display-mode: standalone)')
displayModeQuery.addEventListener('change', checkPwaMode)

// Listen for online/offline
window.addEventListener('online', () => isOnline.value = true)
window.addEventListener('offline', () => isOnline.value = false)

// Capture install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  canInstall.value = true
})

window.addEventListener('appinstalled', () => {
  canInstall.value = false
  deferredPrompt = null
})

export function usePwa() {
  async function promptInstall() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    canInstall.value = false
    return outcome === 'accepted'
  }

  return {
    isPwa,
    isOnline,
    canInstall,
    promptInstall
  }
}

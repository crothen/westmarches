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
window.addEventListener('online', () => {
  isOnline.value = true
  document.body.classList.remove('offline')
})
window.addEventListener('offline', () => {
  isOnline.value = false
  document.body.classList.add('offline')
})

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

// Haptic feedback (light tap)
function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isPwa.value) return
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 }
    navigator.vibrate(patterns[style])
  }
}

// Setup haptic feedback on button clicks in PWA mode
if (isPwa.value) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, [role="button"]')) {
      haptic('light')
    }
  }, { passive: true })
}

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
    promptInstall,
    haptic
  }
}

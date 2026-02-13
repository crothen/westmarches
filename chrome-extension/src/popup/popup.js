// West Marches Extension - Popup Script

const WESTMARCHES_URL = 'https://westmarches-dnd.web.app'

// Default settings
const DEFAULT_SETTINGS = {
  bottomNavEnabled: true,
  fabEnabled: true,
  paletteEnabled: true,
  darkMode: true
}

// DOM elements
let loadingEl, mainEl
let userSection, loginSection
let userPhotoEl, userNameEl, userEmailEl
let loginError, emailInput, passwordInput
let googleLoginBtn, emailLoginBtn, logoutBtn

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  loadingEl = document.getElementById('loading')
  mainEl = document.getElementById('main')
  userSection = document.getElementById('user-section')
  loginSection = document.getElementById('login-section')
  userPhotoEl = document.getElementById('user-photo')
  userNameEl = document.getElementById('user-name')
  userEmailEl = document.getElementById('user-email')
  loginError = document.getElementById('login-error')
  emailInput = document.getElementById('email-input')
  passwordInput = document.getElementById('password-input')
  googleLoginBtn = document.getElementById('google-login-btn')
  emailLoginBtn = document.getElementById('email-login-btn')
  logoutBtn = document.getElementById('logout-btn')

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active')
    })
  })

  // Toggle switches
  setupToggle('toggle-bottomnav', 'bottomNavEnabled')
  setupToggle('toggle-fab', 'fabEnabled')
  setupToggle('toggle-palette', 'paletteEnabled')
  setupToggle('toggle-darkmode', 'darkMode')

  // Auth buttons
  googleLoginBtn.addEventListener('click', loginWithGoogle)
  emailLoginBtn.addEventListener('click', loginWithEmail)
  logoutBtn.addEventListener('click', logout)

  // Enter key for email login
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginWithEmail()
  })

  // Check auth state and load settings
  await Promise.all([checkAuthState(), loadSettings()])
  
  loadingEl.classList.add('hidden')
  mainEl.classList.remove('hidden')
})

function setupToggle(elementId, settingKey) {
  const toggle = document.getElementById(elementId)
  toggle.addEventListener('click', async () => {
    toggle.classList.toggle('active')
    const enabled = toggle.classList.contains('active')
    await saveSetting(settingKey, enabled)
    notifyContentScripts({ action: 'settingsChanged', key: settingKey, value: enabled })
  })
}

async function loadSettings() {
  const result = await chrome.storage.local.get(['settings'])
  const settings = { ...DEFAULT_SETTINGS, ...result.settings }
  
  // Update toggle UI
  document.getElementById('toggle-bottomnav').classList.toggle('active', settings.bottomNavEnabled)
  document.getElementById('toggle-fab').classList.toggle('active', settings.fabEnabled)
  document.getElementById('toggle-palette').classList.toggle('active', settings.paletteEnabled)
  document.getElementById('toggle-darkmode').classList.toggle('active', settings.darkMode)
}

async function saveSetting(key, value) {
  const result = await chrome.storage.local.get(['settings'])
  const settings = { ...DEFAULT_SETTINGS, ...result.settings, [key]: value }
  await chrome.storage.local.set({ settings })
}

async function checkAuthState() {
  try {
    const result = await chrome.storage.local.get(['user', 'token'])
    if (result.user && result.token) {
      showLoggedIn(result.user)
    } else {
      showLoggedOut()
    }
  } catch (err) {
    console.error('Failed to check auth state:', err)
    showLoggedOut()
  }
}

function showLoggedIn(user) {
  userSection.classList.remove('hidden')
  loginSection.classList.add('hidden')
  
  userNameEl.textContent = user.displayName || 'User'
  userEmailEl.textContent = user.email || ''
  userPhotoEl.src = user.photoURL || '../assets/icon48.png'
}

function showLoggedOut() {
  userSection.classList.add('hidden')
  loginSection.classList.remove('hidden')
  loginError.classList.add('hidden')
}

function showError(message) {
  loginError.textContent = message
  loginError.classList.remove('hidden')
}

async function loginWithGoogle() {
  googleLoginBtn.disabled = true
  googleLoginBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div> Signing in...'
  loginError.classList.add('hidden')
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'login', method: 'google' })
    if (response.success) {
      showLoggedIn(response.user)
    } else {
      showError(response.error || 'Login failed')
    }
  } catch (err) {
    console.error('Login error:', err)
    showError('Login failed: ' + err.message)
  } finally {
    googleLoginBtn.disabled = false
    googleLoginBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:18px;height:18px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continue with Google'
  }
}

async function loginWithEmail() {
  const email = emailInput.value.trim()
  const password = passwordInput.value
  
  if (!email || !password) {
    showError('Please enter email and password')
    return
  }
  
  emailLoginBtn.disabled = true
  emailLoginBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>'
  loginError.classList.add('hidden')
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'login', 
      method: 'email',
      email,
      password
    })
    if (response.success) {
      showLoggedIn(response.user)
    } else {
      showError(response.error || 'Login failed')
    }
  } catch (err) {
    console.error('Login error:', err)
    showError('Login failed: ' + err.message)
  } finally {
    emailLoginBtn.disabled = false
    emailLoginBtn.textContent = 'Sign in'
  }
}

async function logout() {
  try {
    await chrome.runtime.sendMessage({ action: 'logout' })
    showLoggedOut()
  } catch (err) {
    console.error('Logout error:', err)
  }
}

function notifyContentScripts(message) {
  chrome.runtime.sendMessage({ action: 'broadcast', payload: message })
}

// West Marches Extension - Popup Script

const WESTMARCHES_URL = 'https://westmarches-dnd.web.app'

// DOM elements
const loadingEl = document.getElementById('loading')
const loggedOutEl = document.getElementById('logged-out')
const loggedInEl = document.getElementById('logged-in')
const errorEl = document.getElementById('error')
const loginBtn = document.getElementById('login-btn')
const logoutBtn = document.getElementById('logout-btn')
const openWestmarchesBtn = document.getElementById('open-westmarches')
const userPhotoEl = document.getElementById('user-photo')
const userNameEl = document.getElementById('user-name')
const userEmailEl = document.getElementById('user-email')

// Check auth state on load
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
    showError('Failed to load auth state')
  }
}

function showLoading() {
  loadingEl.classList.remove('hidden')
  loggedOutEl.classList.add('hidden')
  loggedInEl.classList.add('hidden')
  errorEl.classList.add('hidden')
}

function showLoggedOut() {
  loadingEl.classList.add('hidden')
  loggedOutEl.classList.remove('hidden')
  loggedInEl.classList.add('hidden')
  errorEl.classList.add('hidden')
}

function showLoggedIn(user) {
  loadingEl.classList.add('hidden')
  loggedOutEl.classList.add('hidden')
  loggedInEl.classList.remove('hidden')
  errorEl.classList.add('hidden')
  
  userNameEl.textContent = user.displayName || 'User'
  userEmailEl.textContent = user.email || ''
  userPhotoEl.src = user.photoURL || '../assets/icon48.png'
}

function showError(message) {
  loadingEl.classList.add('hidden')
  errorEl.classList.remove('hidden')
  errorEl.textContent = message
}

// Login via background script (handles OAuth flow)
async function login() {
  loginBtn.disabled = true
  loginBtn.textContent = 'Signing in...'
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'login' })
    if (response.success) {
      showLoggedIn(response.user)
    } else {
      showError(response.error || 'Login failed')
      showLoggedOut()
    }
  } catch (err) {
    console.error('Login error:', err)
    showError('Login failed: ' + err.message)
    showLoggedOut()
  } finally {
    loginBtn.disabled = false
    loginBtn.textContent = 'Sign in with Google'
  }
}

// Logout
async function logout() {
  try {
    await chrome.runtime.sendMessage({ action: 'logout' })
    showLoggedOut()
  } catch (err) {
    console.error('Logout error:', err)
  }
}

// Open West Marches website
function openWestMarches() {
  chrome.tabs.create({ url: WESTMARCHES_URL })
}

// Event listeners
loginBtn.addEventListener('click', login)
logoutBtn.addEventListener('click', logout)
openWestmarchesBtn.addEventListener('click', openWestMarches)

// Initialize
checkAuthState()

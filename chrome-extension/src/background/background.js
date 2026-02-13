// West Marches Extension - Background Service Worker

// Firebase config (same as westmarches web app)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDpqO9qAw3sJUxMEJpUYOHwPnFV-s9gFz4",
  authDomain: "westmarches-dnd.firebaseapp.com",
  projectId: "westmarches-dnd",
  storageBucket: "westmarches-dnd.firebasestorage.app",
  messagingSenderId: "1084465200262",
  appId: "1:1084465200262:web:1c0c42ac8c8d13582da507"
}

// Google OAuth Client ID (for Chrome extension)
// You'll need to create this in Google Cloud Console
const OAUTH_CLIENT_ID = '1084465200262-EXTENSION_CLIENT_ID.apps.googleusercontent.com'

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    handleLogin().then(sendResponse)
    return true // async response
  }
  if (request.action === 'logout') {
    handleLogout().then(sendResponse)
    return true
  }
  if (request.action === 'getUser') {
    chrome.storage.local.get(['user', 'token']).then(sendResponse)
    return true
  }
  if (request.action === 'firestore') {
    handleFirestoreRequest(request).then(sendResponse)
    return true
  }
})

// Handle login via Chrome identity API
async function handleLogin() {
  try {
    // Use chrome.identity for OAuth flow
    const redirectUrl = chrome.identity.getRedirectURL()
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', redirectUrl)
    authUrl.searchParams.set('response_type', 'token')
    authUrl.searchParams.set('scope', 'openid email profile')
    
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    })
    
    // Extract token from response URL
    const url = new URL(responseUrl)
    const params = new URLSearchParams(url.hash.substring(1))
    const accessToken = params.get('access_token')
    
    if (!accessToken) {
      throw new Error('No access token received')
    }
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const userInfo = await userInfoResponse.json()
    
    // Exchange Google token for Firebase token
    const firebaseToken = await exchangeForFirebaseToken(accessToken)
    
    const user = {
      uid: userInfo.id,
      email: userInfo.email,
      displayName: userInfo.name,
      photoURL: userInfo.picture
    }
    
    // Store in chrome.storage
    await chrome.storage.local.set({ 
      user, 
      token: firebaseToken,
      accessToken 
    })
    
    // Notify content scripts
    notifyContentScripts({ action: 'authStateChanged', user })
    
    return { success: true, user }
  } catch (err) {
    console.error('Login failed:', err)
    return { success: false, error: err.message }
  }
}

// Exchange Google OAuth token for Firebase ID token
async function exchangeForFirebaseToken(googleAccessToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: 'https://westmarches-dnd.firebaseapp.com',
        postBody: `access_token=${googleAccessToken}&providerId=google.com`,
        returnSecureToken: true,
        returnIdpCredential: true
      })
    }
  )
  
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message)
  }
  
  return data.idToken
}

// Handle logout
async function handleLogout() {
  await chrome.storage.local.remove(['user', 'token', 'accessToken'])
  notifyContentScripts({ action: 'authStateChanged', user: null })
  return { success: true }
}

// Notify all content scripts of state changes
async function notifyContentScripts(message) {
  const tabs = await chrome.tabs.query({ url: ['https://www.dndbeyond.com/*', 'https://*.dndbeyond.com/*'] })
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message)
    } catch (e) {
      // Tab might not have content script loaded
    }
  }
}

// Handle Firestore requests from content scripts
async function handleFirestoreRequest(request) {
  const { token } = await chrome.storage.local.get(['token'])
  if (!token) {
    return { success: false, error: 'Not authenticated' }
  }
  
  const { collection, action, data, docId } = request
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`
  
  try {
    if (action === 'list') {
      const response = await fetch(`${baseUrl}/${collection}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await response.json()
      return { success: true, documents: result.documents || [] }
    }
    
    if (action === 'get') {
      const response = await fetch(`${baseUrl}/${collection}/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await response.json()
      return { success: true, document: result }
    }
    
    if (action === 'create') {
      const response = await fetch(`${baseUrl}/${collection}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: convertToFirestoreFields(data) })
      })
      const result = await response.json()
      return { success: true, document: result }
    }
    
    return { success: false, error: 'Unknown action' }
  } catch (err) {
    console.error('Firestore error:', err)
    return { success: false, error: err.message }
  }
}

// Convert JS object to Firestore field format
function convertToFirestoreFields(obj) {
  const fields = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      fields[key] = { stringValue: value }
    } else if (typeof value === 'number') {
      fields[key] = Number.isInteger(value) ? { integerValue: value } : { doubleValue: value }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value }
    } else if (Array.isArray(value)) {
      fields[key] = { arrayValue: { values: value.map(v => ({ stringValue: String(v) })) } }
    } else if (value === null) {
      fields[key] = { nullValue: null }
    }
  }
  return fields
}

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  
  if (command === 'toggle-command-palette') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleCommandPalette' })
  } else if (command === 'toggle-sidebar') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' })
  }
})

console.log('West Marches extension background script loaded')

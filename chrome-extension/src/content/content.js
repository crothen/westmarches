// West Marches Extension - Content Script
// Injected into D&D Beyond pages

let commandPaletteOpen = false
let sidebarOpen = false
let currentUser = null
let settings = {
  bottomNavEnabled: true,
  fabEnabled: true,
  paletteEnabled: true,
  darkMode: true
}

// Initialize
async function init() {
  // Get current user and settings
  const [userResult, settingsResult] = await Promise.all([
    chrome.storage.local.get(['user']),
    chrome.storage.local.get(['settings'])
  ])
  currentUser = userResult.user
  settings = { ...settings, ...settingsResult.settings }
  
  // Create UI components based on settings
  if (settings.paletteEnabled) createCommandPalette()
  if (settings.fabEnabled) createQuickActionButton()
  createSidebar()
  
  // Create bottom nav on character sheets
  if (settings.bottomNavEnabled) {
    // Wait a bit for D&D Beyond to fully load
    setTimeout(() => createBottomNav(), 1000)
  }
  
  console.log('West Marches extension loaded on D&D Beyond')
}

// ============================================
// Bottom Navigation Bar (from bookmarklet)
// ============================================

function createBottomNav() {
  // Only on character pages
  if (!window.location.pathname.includes('/characters/')) return
  
  // Don't create if already exists
  if (document.getElementById('wm-bottom-nav')) return
  
  // Find the section nav dialog
  const dialog = document.querySelector('dialog[class*="sectionNav"]')
  if (!dialog) {
    // Try again later if dialog not found yet
    setTimeout(() => createBottomNav(), 2000)
    return
  }
  
  const labels = ['Abilities', 'Actions', 'Inventory', 'Spells', 'Features', 'Background', 'Notes', 'Extras']
  
  const navBar = document.createElement('div')
  navBar.id = 'wm-bottom-nav'
  navBar.className = 'wm-bottom-nav'
  
  document.body.style.overscrollBehavior = 'none'
  document.documentElement.style.overscrollBehavior = 'none'
  
  const seen = new Set()
  let idx = 0
  let activeBtn = null
  
  dialog.querySelectorAll('button[class*="sectionButton"]').forEach(btn => {
    if (btn.className.includes('mobile')) return
    const svg = btn.querySelector('svg')
    if (!svg) return
    const title = btn.textContent.trim().split(',')[0]
    if (seen.has(title)) return
    seen.add(title)
    
    const wrapper = document.createElement('div')
    wrapper.className = 'wm-nav-item'
    
    const clone = document.createElement('button')
    clone.className = 'wm-nav-btn'
    clone.innerHTML = svg.outerHTML
    clone.title = labels[idx] || title
    clone.dataset.btnTitle = title
    
    const cloneSvg = clone.querySelector('svg')
    cloneSvg.querySelectorAll('*').forEach(el => {
      el.removeAttribute('fill')
      el.removeAttribute('stroke')
    })
    
    const label = document.createElement('span')
    label.className = 'wm-nav-label'
    label.textContent = labels[idx] || title
    
    wrapper.appendChild(clone)
    wrapper.appendChild(label)
    
    clone.addEventListener('click', () => {
      // Re-query the dialog to find fresh button references
      const dlg = document.querySelector('dialog[class*="sectionNav"]')
      if (!dlg) return
      
      const targetTitle = clone.dataset.btnTitle
      let found = null
      dlg.querySelectorAll('button[class*="sectionButton"]').forEach(b => {
        if (b.className.includes('mobile')) return
        const t = b.textContent.trim().split(',')[0]
        if (t === targetTitle) found = b
      })
      
      if (found) found.click()
      
      // Update active state
      if (activeBtn) {
        activeBtn.btn.classList.remove('active')
        activeBtn.label.classList.remove('active')
      }
      clone.classList.add('active')
      label.classList.add('active')
      activeBtn = { btn: clone, label }
    })
    
    navBar.appendChild(wrapper)
    idx++
  })
  
  // Fullscreen toggle
  const fsWrapper = document.createElement('div')
  fsWrapper.className = 'wm-nav-item wm-nav-divider'
  
  const fsBtn = document.createElement('button')
  fsBtn.className = 'wm-nav-btn wm-nav-fs'
  fsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
  fsBtn.title = 'Fullscreen'
  
  const fsLabel = document.createElement('span')
  fsLabel.className = 'wm-nav-label'
  fsLabel.textContent = 'Fullscreen'
  
  fsWrapper.appendChild(fsBtn)
  fsWrapper.appendChild(fsLabel)
  
  fsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      fsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
    } else {
      document.exitFullscreen()
      fsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
    }
  })
  
  navBar.appendChild(fsWrapper)
  document.body.appendChild(navBar)
  
  // Add padding to sheet
  const sheet = document.querySelector('.ct-character-sheet')
  if (sheet) sheet.style.paddingBottom = '100px'
  
  // Hide original toggle
  const toggle = document.querySelector('button[class*="navToggle"]')
  if (toggle) toggle.style.display = 'none'
  
  // Handle fullscreen change
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      fsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
    }
  })
}

function destroyBottomNav() {
  const nav = document.getElementById('wm-bottom-nav')
  if (nav) nav.remove()
  
  const sheet = document.querySelector('.ct-character-sheet')
  if (sheet) sheet.style.paddingBottom = ''
  
  const toggle = document.querySelector('button[class*="navToggle"]')
  if (toggle) toggle.style.display = ''
}

// ============================================
// Command Palette (Cmd+K)
// ============================================

function createCommandPalette() {
  if (document.getElementById('wm-command-palette')) return
  
  const palette = document.createElement('div')
  palette.id = 'wm-command-palette'
  palette.className = 'wm-command-palette wm-hidden'
  palette.innerHTML = `
    <div class="wm-palette-backdrop"></div>
    <div class="wm-palette-container">
      <div class="wm-palette-header">
        <input type="text" class="wm-palette-input" placeholder="Search D&D Beyond, West Marches..." autofocus />
      </div>
      <div class="wm-palette-results"></div>
      <div class="wm-palette-footer">
        <span>↑↓ Navigate</span>
        <span>↵ Open</span>
        <span>esc Close</span>
      </div>
    </div>
  `
  document.body.appendChild(palette)
  
  // Event listeners
  const backdrop = palette.querySelector('.wm-palette-backdrop')
  const input = palette.querySelector('.wm-palette-input')
  const results = palette.querySelector('.wm-palette-results')
  
  backdrop.addEventListener('click', () => toggleCommandPalette(false))
  
  input.addEventListener('input', (e) => {
    handleSearch(e.target.value, results)
  })
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleCommandPalette(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      navigateResults(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigateResults(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectResult()
    }
  })
}

function toggleCommandPalette(show = !commandPaletteOpen) {
  if (!settings.paletteEnabled && show) return
  
  commandPaletteOpen = show
  const palette = document.getElementById('wm-command-palette')
  if (!palette) return
  
  if (show) {
    palette.classList.remove('wm-hidden')
    const input = palette.querySelector('.wm-palette-input')
    input.value = ''
    input.focus()
    showDefaultResults(palette.querySelector('.wm-palette-results'))
  } else {
    palette.classList.add('wm-hidden')
  }
}

function showDefaultResults(container) {
  const quickActions = [
    { icon: '🗺️', label: 'Open Map', action: () => toggleSidebar(true) },
    { icon: '👤', label: 'Quick NPC', action: () => showQuickNpcModal() },
    { icon: '📝', label: 'Quick Note', action: () => showQuickNoteModal() },
    { icon: '🌐', label: 'Open West Marches', action: () => window.open('https://westmarches-dnd.web.app', '_blank') },
  ]
  
  container.innerHTML = `
    <div class="wm-result-group">
      <div class="wm-result-group-title">Quick Actions</div>
      ${quickActions.map((a, i) => `
        <div class="wm-result-item ${i === 0 ? 'wm-selected' : ''}" data-index="${i}">
          <span class="wm-result-icon">${a.icon}</span>
          <span class="wm-result-label">${a.label}</span>
        </div>
      `).join('')}
    </div>
  `
  
  container.querySelectorAll('.wm-result-item').forEach((item, i) => {
    item.addEventListener('click', () => {
      quickActions[i].action()
      toggleCommandPalette(false)
    })
  })
}

async function handleSearch(query, container) {
  if (!query.trim()) {
    showDefaultResults(container)
    return
  }
  
  const q = query.toLowerCase()
  const results = []
  
  const ddbPages = [
    { icon: '👤', label: 'My Characters', url: '/my-characters' },
    { icon: '📖', label: 'My Campaigns', url: '/my-campaigns' },
    { icon: '📚', label: 'Spells', url: '/spells' },
    { icon: '⚔️', label: 'Equipment', url: '/equipment' },
    { icon: '👹', label: 'Monsters', url: '/monsters' },
    { icon: '📜', label: 'Magic Items', url: '/magic-items' },
    { icon: '🎭', label: 'Backgrounds', url: '/backgrounds' },
    { icon: '🧬', label: 'Races', url: '/races' },
    { icon: '⚔️', label: 'Classes', url: '/classes' },
    { icon: '✨', label: 'Feats', url: '/feats' },
  ]
  
  const wmPages = [
    { icon: '🗺️', label: 'WM: Map', url: 'https://westmarches-dnd.web.app/map' },
    { icon: '📖', label: 'WM: Sessions', url: 'https://westmarches-dnd.web.app/sessions' },
    { icon: '👤', label: 'WM: NPCs', url: 'https://westmarches-dnd.web.app/npcs' },
    { icon: '🏰', label: 'WM: Locations', url: 'https://westmarches-dnd.web.app/locations' },
    { icon: '📅', label: 'WM: Calendar', url: 'https://westmarches-dnd.web.app/calendar' },
    { icon: '⚔️', label: 'WM: Missions', url: 'https://westmarches-dnd.web.app/missions' },
  ]
  
  const matchingPages = ddbPages.filter(p => p.label.toLowerCase().includes(q))
  const matchingWmPages = wmPages.filter(p => p.label.toLowerCase().includes(q))
  
  let html = ''
  
  if (matchingPages.length > 0) {
    html += `
      <div class="wm-result-group">
        <div class="wm-result-group-title">D&D Beyond</div>
        ${matchingPages.slice(0, 5).map((p, i) => `
          <div class="wm-result-item ${results.length === 0 && i === 0 ? 'wm-selected' : ''}" data-url="${p.url}" data-index="${results.length + i}">
            <span class="wm-result-icon">${p.icon}</span>
            <span class="wm-result-label">${p.label}</span>
          </div>
        `).join('')}
      </div>
    `
    results.push(...matchingPages.slice(0, 5))
  }
  
  if (matchingWmPages.length > 0) {
    html += `
      <div class="wm-result-group">
        <div class="wm-result-group-title">West Marches</div>
        ${matchingWmPages.slice(0, 5).map((p, i) => `
          <div class="wm-result-item" data-url="${p.url}" data-index="${results.length + i}">
            <span class="wm-result-icon">${p.icon}</span>
            <span class="wm-result-label">${p.label}</span>
          </div>
        `).join('')}
      </div>
    `
    results.push(...matchingWmPages.slice(0, 5))
  }
  
  // Always add a "Search D&D Beyond" option for the query
  html += `
    <div class="wm-result-group">
      <div class="wm-result-group-title">Search</div>
      <div class="wm-result-item" data-url="https://www.dndbeyond.com/search?q=${encodeURIComponent(query)}" data-index="${results.length}">
        <span class="wm-result-icon">🔍</span>
        <span class="wm-result-label">Search D&D Beyond for "${query}"</span>
      </div>
    </div>
  `
  
  if (html === '') {
    html = '<div class="wm-no-results">No results found</div>'
  }
  
  container.innerHTML = html
  
  container.querySelectorAll('.wm-result-item').forEach((item) => {
    item.addEventListener('click', () => {
      const url = item.dataset.url
      if (url.startsWith('http')) {
        window.open(url, '_blank')
      } else {
        // Relative D&D Beyond URLs - open in new tab
        window.open(`https://www.dndbeyond.com${url}`, '_blank')
      }
      toggleCommandPalette(false)
    })
  })
}

let selectedIndex = 0

function navigateResults(direction) {
  const items = document.querySelectorAll('.wm-result-item')
  if (items.length === 0) return
  
  items[selectedIndex]?.classList.remove('wm-selected')
  selectedIndex = (selectedIndex + direction + items.length) % items.length
  items[selectedIndex]?.classList.add('wm-selected')
  items[selectedIndex]?.scrollIntoView({ block: 'nearest' })
}

function selectResult() {
  const selected = document.querySelector('.wm-result-item.wm-selected')
  if (selected) selected.click()
}

// ============================================
// Sidebar (Map + Quick Actions)
// ============================================

// Load web component script
let wcLoaded = false
function loadWebComponent() {
  if (wcLoaded) return Promise.resolve()
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://westmarches-dnd.web.app/wc/westmarches.js'
    script.type = 'module'
    script.onload = () => {
      wcLoaded = true
      resolve()
    }
    script.onerror = () => {
      console.warn('Failed to load WM web components, falling back to iframe')
      resolve()
    }
    document.head.appendChild(script)
  })
}

function createSidebar() {
  if (document.getElementById('wm-sidebar')) return
  
  const sidebar = document.createElement('div')
  sidebar.id = 'wm-sidebar'
  sidebar.className = 'wm-sidebar wm-hidden'
  sidebar.innerHTML = `
    <div class="wm-sidebar-header">
      <span class="wm-sidebar-title">🐉 West Marches</span>
      <button class="wm-sidebar-close">✕</button>
    </div>
    <div class="wm-sidebar-tabs">
      <button class="wm-tab wm-tab-active" data-tab="map">Map</button>
      <button class="wm-tab" data-tab="browse">Browse</button>
      <button class="wm-tab" data-tab="quick">Quick Add</button>
    </div>
    <div class="wm-sidebar-content">
      <div class="wm-tab-panel wm-tab-panel-active" data-panel="map">
        <div id="wm-map-container" class="wm-map-container"></div>
      </div>
      <div class="wm-tab-panel" data-panel="browse">
        <iframe src="https://westmarches-dnd.web.app?embed=true" class="wm-map-iframe"></iframe>
      </div>
      <div class="wm-tab-panel" data-panel="quick">
        <div class="wm-quick-section">
          <button class="wm-quick-btn" id="wm-quick-npc">👤 Quick NPC</button>
          <button class="wm-quick-btn" id="wm-quick-note">📝 Quick Note</button>
          <button class="wm-quick-btn" id="wm-quick-marker">📍 Add Marker</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(sidebar)
  
  sidebar.querySelector('.wm-sidebar-close').addEventListener('click', () => toggleSidebar(false))
  
  sidebar.querySelectorAll('.wm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      sidebar.querySelectorAll('.wm-tab').forEach(t => t.classList.remove('wm-tab-active'))
      sidebar.querySelectorAll('.wm-tab-panel').forEach(p => p.classList.remove('wm-tab-panel-active'))
      tab.classList.add('wm-tab-active')
      sidebar.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('wm-tab-panel-active')
    })
  })
  
  sidebar.querySelector('#wm-quick-npc')?.addEventListener('click', showQuickNpcModal)
  sidebar.querySelector('#wm-quick-note')?.addEventListener('click', showQuickNoteModal)
  sidebar.querySelector('#wm-quick-marker')?.addEventListener('click', showQuickMarkerModal)

  // Load web component and create map
  loadWebComponent().then(async () => {
    if (wcLoaded && customElements.get('wm-map')) {
      const container = document.getElementById('wm-map-container')
      if (container) {
        const map = document.createElement('wm-map')
        
        // Get auth token and user info
        const result = await chrome.storage.local.get(['token', 'user'])
        if (result.token) {
          map.authToken = result.token
        }
        if (result.user) {
          map.userId = result.user.uid || ''
          map.userName = result.user.displayName || 'Anonymous'
        }
        
        container.appendChild(map)
      }
    } else {
      // Fallback to iframe if WC failed to load
      const container = document.getElementById('wm-map-container')
      if (container) {
        container.innerHTML = '<iframe src="https://westmarches-dnd.web.app/map?embed=true" class="wm-map-iframe"></iframe>'
      }
    }
  })
}

function toggleSidebar(show = !sidebarOpen, url = null) {
  sidebarOpen = show
  const sidebar = document.getElementById('wm-sidebar')
  if (!sidebar) return
  
  if (show) {
    sidebar.classList.remove('wm-hidden')
    
    // If URL provided, load it in the Browse tab iframe
    if (url) {
      const iframe = sidebar.querySelector('[data-panel="browse"] .wm-map-iframe')
      if (iframe) {
        iframe.src = url + (url.includes('?') ? '&' : '?') + 'embed=true'
      }
      // Switch to Browse tab
      sidebar.querySelectorAll('.wm-tab').forEach(t => t.classList.remove('wm-tab-active'))
      sidebar.querySelectorAll('.wm-tab-panel').forEach(p => p.classList.remove('wm-tab-panel-active'))
      sidebar.querySelector('[data-tab="browse"]')?.classList.add('wm-tab-active')
      sidebar.querySelector('[data-panel="browse"]')?.classList.add('wm-tab-panel-active')
    }
  } else {
    sidebar.classList.add('wm-hidden')
  }
}

// ============================================
// Quick Action Button (floating)
// ============================================

function createQuickActionButton() {
  if (document.getElementById('wm-quick-btn')) return
  
  const btn = document.createElement('button')
  btn.id = 'wm-quick-btn'
  btn.className = 'wm-quick-action-btn'
  btn.innerHTML = '🐉'
  btn.title = 'West Marches (Ctrl+K)'
  document.body.appendChild(btn)
  
  btn.addEventListener('click', () => toggleCommandPalette(true))
}

function destroyQuickActionButton() {
  const btn = document.getElementById('wm-quick-btn')
  if (btn) btn.remove()
}

// ============================================
// Quick Modals
// ============================================

function showQuickNpcModal() {
  toggleCommandPalette(false)
  
  const modal = document.createElement('div')
  modal.className = 'wm-modal'
  modal.innerHTML = `
    <div class="wm-modal-backdrop"></div>
    <div class="wm-modal-container">
      <div class="wm-modal-header">
        <h2>👤 Quick NPC</h2>
        <button class="wm-modal-close">✕</button>
      </div>
      <div class="wm-modal-body">
        <div class="wm-form-group">
          <label>Name</label>
          <input type="text" id="wm-npc-name" placeholder="NPC name..." />
        </div>
        <div class="wm-form-group">
          <label>Race</label>
          <input type="text" id="wm-npc-race" placeholder="Human, Elf, etc..." />
        </div>
        <div class="wm-form-group">
          <label>Description</label>
          <textarea id="wm-npc-desc" rows="3" placeholder="Brief description..."></textarea>
        </div>
        <div class="wm-form-group">
          <label>Tags</label>
          <input type="text" id="wm-npc-tags" placeholder="merchant, friendly, bern..." />
        </div>
      </div>
      <div class="wm-modal-footer">
        <button class="wm-btn wm-btn-secondary wm-modal-cancel">Cancel</button>
        <button class="wm-btn wm-btn-primary" id="wm-npc-save">Create NPC</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  const closeModal = () => modal.remove()
  modal.querySelector('.wm-modal-backdrop').addEventListener('click', closeModal)
  modal.querySelector('.wm-modal-close').addEventListener('click', closeModal)
  modal.querySelector('.wm-modal-cancel').addEventListener('click', closeModal)
  
  modal.querySelector('#wm-npc-save').addEventListener('click', async () => {
    const name = document.getElementById('wm-npc-name').value.trim()
    const race = document.getElementById('wm-npc-race').value.trim()
    const description = document.getElementById('wm-npc-desc').value.trim()
    const tags = document.getElementById('wm-npc-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    
    if (!name) {
      alert('Name is required')
      return
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'firestore',
        collection: 'npcs',
        action: 'create',
        data: { name, race, description, tags, createdAt: new Date().toISOString() }
      })
      
      if (response.success) {
        showToast('NPC created successfully!')
        closeModal()
      } else {
        alert('Failed to create NPC: ' + response.error)
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  })
  
  modal.querySelector('#wm-npc-name').focus()
}

function showQuickNoteModal() {
  toggleCommandPalette(false)
  
  const modal = document.createElement('div')
  modal.className = 'wm-modal'
  modal.innerHTML = `
    <div class="wm-modal-backdrop"></div>
    <div class="wm-modal-container">
      <div class="wm-modal-header">
        <h2>📝 Quick Note</h2>
        <button class="wm-modal-close">✕</button>
      </div>
      <div class="wm-modal-body">
        <div class="wm-form-group">
          <label>Note</label>
          <textarea id="wm-note-content" rows="5" placeholder="Write your note..."></textarea>
        </div>
      </div>
      <div class="wm-modal-footer">
        <button class="wm-btn wm-btn-secondary wm-modal-cancel">Cancel</button>
        <button class="wm-btn wm-btn-primary" id="wm-note-save">Save Note</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  const closeModal = () => modal.remove()
  modal.querySelector('.wm-modal-backdrop').addEventListener('click', closeModal)
  modal.querySelector('.wm-modal-close').addEventListener('click', closeModal)
  modal.querySelector('.wm-modal-cancel').addEventListener('click', closeModal)
  
  modal.querySelector('#wm-note-save').addEventListener('click', async () => {
    const content = document.getElementById('wm-note-content').value.trim()
    if (!content) {
      alert('Note content is required')
      return
    }
    
    await navigator.clipboard.writeText(content)
    showToast('Note copied to clipboard!')
    closeModal()
  })
  
  modal.querySelector('#wm-note-content').focus()
}

function showQuickMarkerModal() {
  toggleCommandPalette(false)
  showToast('Open the map to add markers')
  toggleSidebar(true)
}

// ============================================
// Toast notifications
// ============================================

function showToast(message, duration = 3000) {
  const existing = document.querySelector('.wm-toast')
  if (existing) existing.remove()
  
  const toast = document.createElement('div')
  toast.className = 'wm-toast'
  toast.textContent = message
  document.body.appendChild(toast)
  
  setTimeout(() => toast.classList.add('wm-toast-visible'), 10)
  setTimeout(() => {
    toast.classList.remove('wm-toast-visible')
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

// ============================================
// Message handlers
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleCommandPalette') {
    toggleCommandPalette()
  } else if (request.action === 'toggleSidebar') {
    toggleSidebar()
  } else if (request.action === 'openSidebar') {
    toggleSidebar(true, request.url)
  } else if (request.action === 'authStateChanged') {
    currentUser = request.user
  } else if (request.action === 'settingsChanged') {
    settings[request.key] = request.value
    handleSettingChange(request.key, request.value)
  }
})

function handleSettingChange(key, value) {
  if (key === 'bottomNavEnabled') {
    if (value) {
      createBottomNav()
    } else {
      destroyBottomNav()
    }
  } else if (key === 'fabEnabled') {
    if (value) {
      createQuickActionButton()
    } else {
      destroyQuickActionButton()
    }
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    toggleCommandPalette()
  }
  if (e.key === 'Escape') {
    if (commandPaletteOpen) toggleCommandPalette(false)
    if (sidebarOpen) toggleSidebar(false)
  }
})

// ============================================
// Star Button (Bookmark DDB Entities)
// ============================================

const ENTITY_PATTERNS = [
  { type: 'item', pattern: /\/equipment\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'magic-item', pattern: /\/magic-items\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'spell', pattern: /\/spells\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'monster', pattern: /\/monsters\/([^\/\?]+)/, nameSelector: '.mon-stat-block__name-link, .page-title' },
  { type: 'feat', pattern: /\/feats\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'race', pattern: /\/races\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'species', pattern: /\/species\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'class', pattern: /\/classes\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'subclass', pattern: /\/subclasses\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'background', pattern: /\/backgrounds\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
  { type: 'vehicle', pattern: /\/vehicles\/([^\/\?]+)/, nameSelector: '.page-title, h1.content-title' },
]

// Detect entity type from a URL path (for list/search inline stars)
function detectEntityFromUrl(url) {
  try {
    const path = new URL(url, window.location.origin).pathname
    const patterns = [
      { type: 'spell', pattern: /\/spells\/([^\/\?]+)/ },
      { type: 'monster', pattern: /\/monsters\/([^\/\?]+)/ },
      { type: 'magic-item', pattern: /\/magic-items\/([^\/\?]+)/ },
      { type: 'item', pattern: /\/equipment\/([^\/\?]+)/ },
      { type: 'feat', pattern: /\/feats\/([^\/\?]+)/ },
      { type: 'race', pattern: /\/races\/([^\/\?]+)/ },
      { type: 'species', pattern: /\/species\/([^\/\?]+)/ },
      { type: 'class', pattern: /\/classes\/([^\/\?]+)/ },
      { type: 'subclass', pattern: /\/subclasses\/([^\/\?]+)/ },
      { type: 'background', pattern: /\/backgrounds\/([^\/\?]+)/ },
      { type: 'vehicle', pattern: /\/vehicles\/([^\/\?]+)/ },
    ]
    for (const p of patterns) {
      const match = path.match(p.pattern)
      if (match) return { type: p.type, slug: match[1] }
    }
  } catch (e) {
    console.warn('[WM] detectEntityFromUrl error:', e)
  }
  return null
}

function detectEntity() {
  const path = window.location.pathname
  console.log('[WM] detectEntity path:', path)
  for (const entity of ENTITY_PATTERNS) {
    const match = path.match(entity.pattern)
    if (match) {
      console.log('[WM] Matched:', entity.type, match[1])
      const nameEl = document.querySelector(entity.nameSelector)
      const name = nameEl?.textContent?.trim() || match[1].replace(/-/g, ' ')
      // Try to get image
      const imgEl = document.querySelector('.detail-content img, .mon-stat-block__image img, .image img')
      const image = imgEl?.src || null
      return {
        type: entity.type,
        slug: match[1],
        name,
        url: window.location.href,
        image
      }
    }
  }
  console.log('[WM] No entity match')
  return null
}

let currentBookmarkId = null

async function createStarButton() {
  console.log('[WM] createStarButton called')
  // Don't create if already exists
  if (document.getElementById('wm-star-btn')) {
    console.log('[WM] Star button already exists')
    return
  }
  
  const entity = detectEntity()
  if (!entity) {
    console.log('[WM] No entity detected, skipping star button')
    return
  }
  
  console.log('[WM] Creating star button for:', entity.type, entity.name)
  
  // Check if already bookmarked
  const isStarred = await checkIfBookmarked(entity.url)
  console.log('[WM] isStarred:', isStarred)
  
  const btn = document.createElement('button')
  btn.id = 'wm-star-btn'
  btn.className = 'wm-star-btn' + (isStarred ? ' wm-starred' : '')
  btn.innerHTML = isStarred ? '⭐' : '☆'
  btn.title = isStarred ? 'Remove from West Marches' : 'Save to West Marches'
  document.body.appendChild(btn)
  
  btn.addEventListener('click', async () => {
    const wasStarred = btn.classList.contains('wm-starred')
    
    if (wasStarred) {
      // Remove bookmark
      const success = await removeBookmark(entity.url)
      if (success) {
        btn.classList.remove('wm-starred')
        btn.innerHTML = '☆'
        btn.title = 'Save to West Marches'
        showToast('Removed from saved')
      }
    } else {
      // Show modal to add note
      showStarModal(entity, btn)
    }
  })
}

async function checkIfBookmarked(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'bookmark',
      method: 'check',
      url
    })
    if (response.success && response.bookmarkId) {
      currentBookmarkId = response.bookmarkId
      return true
    }
    return false
  } catch (err) {
    console.error('Failed to check bookmark:', err)
    return false
  }
}

async function removeBookmark(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'bookmark',
      method: 'remove',
      url
    })
    return response.success
  } catch (err) {
    console.error('Failed to remove bookmark:', err)
    return false
  }
}

async function saveBookmark(entity, note) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'bookmark',
      method: 'save',
      data: {
        ...entity,
        note: note || null,
        savedAt: new Date().toISOString()
      }
    })
    return response.success
  } catch (err) {
    console.error('Failed to save bookmark:', err)
    return false
  }
}

function showStarModal(entity, starBtn) {
  // Remove existing modal
  const existing = document.querySelector('.wm-star-modal')
  if (existing) existing.remove()
  
  const modal = document.createElement('div')
  modal.className = 'wm-modal wm-star-modal'
  modal.innerHTML = `
    <div class="wm-modal-backdrop"></div>
    <div class="wm-modal-container" style="max-width: 400px;">
      <div class="wm-modal-header">
        <h2>⭐ Save ${entity.type}</h2>
        <button class="wm-modal-close">✕</button>
      </div>
      <div class="wm-modal-body">
        <div class="wm-star-preview">
          ${entity.image ? `<img src="${entity.image}" alt="${entity.name}" class="wm-star-img" />` : ''}
          <div class="wm-star-name">${entity.name}</div>
          <div class="wm-star-type">${entity.type}</div>
        </div>
        <div class="wm-form-group">
          <label>Note (optional)</label>
          <textarea id="wm-star-note" rows="3" placeholder="Why are you saving this?"></textarea>
        </div>
      </div>
      <div class="wm-modal-footer">
        <button class="wm-btn wm-btn-secondary wm-modal-cancel">Cancel</button>
        <button class="wm-btn wm-btn-primary" id="wm-star-save">⭐ Save</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  const closeModal = () => modal.remove()
  modal.querySelector('.wm-modal-backdrop').addEventListener('click', closeModal)
  modal.querySelector('.wm-modal-close').addEventListener('click', closeModal)
  modal.querySelector('.wm-modal-cancel').addEventListener('click', closeModal)
  
  modal.querySelector('#wm-star-save').addEventListener('click', async () => {
    const note = document.getElementById('wm-star-note').value.trim()
    const saveBtn = modal.querySelector('#wm-star-save')
    saveBtn.disabled = true
    saveBtn.innerHTML = '<div class="wm-spinner"></div>'
    
    const success = await saveBookmark(entity, note)
    if (success) {
      starBtn.classList.add('wm-starred')
      starBtn.innerHTML = '⭐'
      starBtn.title = 'Remove from West Marches'
      showToast('Saved to West Marches!')
      closeModal()
    } else {
      showToast('Failed to save - are you logged in?')
      saveBtn.disabled = false
      saveBtn.innerHTML = '⭐ Save'
    }
  })
  
  modal.querySelector('#wm-star-note').focus()
}

// ============================================
// Inline Star Buttons (List & Search Pages)
// ============================================

async function addInlineStarButtons() {
  console.log('[WM] addInlineStarButtons called')
  
  // Selectors for different page types
  const itemSelectors = [
    // Spell/monster/item listing pages
    '.listing .info .row.spell-name .name a.link',
    '.listing .info .row.monster-name .name a.link',
    '.listing .info .row.item-name .name a.link',
    // General listing items
    '.listing-body .info a.link',
    // Search results
    '.ddb-search-results-listing-item-header-primary-text a.link',
  ]
  
  const links = document.querySelectorAll(itemSelectors.join(', '))
  console.log('[WM] Found', links.length, 'entity links')
  
  for (const link of links) {
    // Skip if already processed
    if (link.dataset.wmStarAdded) continue
    link.dataset.wmStarAdded = 'true'
    
    const href = link.getAttribute('href')
    if (!href) continue
    
    const entityInfo = detectEntityFromUrl(href)
    if (!entityInfo) continue
    
    const fullUrl = new URL(href, window.location.origin).href
    const name = link.textContent.trim()
    
    // Create inline star button
    const starBtn = document.createElement('button')
    starBtn.className = 'wm-inline-star'
    starBtn.innerHTML = '☆'
    starBtn.title = 'Save to West Marches'
    starBtn.dataset.url = fullUrl
    starBtn.dataset.type = entityInfo.type
    starBtn.dataset.slug = entityInfo.slug
    starBtn.dataset.name = name
    
    // Check if bookmarked (async, don't await to avoid blocking)
    checkIfBookmarked(fullUrl).then(isStarred => {
      if (isStarred) {
        starBtn.classList.add('wm-starred')
        starBtn.innerHTML = '⭐'
        starBtn.title = 'Remove from West Marches'
      }
    })
    
    // Click handler
    starBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      const wasStarred = starBtn.classList.contains('wm-starred')
      const entity = {
        type: starBtn.dataset.type,
        slug: starBtn.dataset.slug,
        name: starBtn.dataset.name,
        url: starBtn.dataset.url,
        image: null
      }
      
      if (wasStarred) {
        const success = await removeBookmark(entity.url)
        if (success) {
          starBtn.classList.remove('wm-starred')
          starBtn.innerHTML = '☆'
          starBtn.title = 'Save to West Marches'
          showToast('Removed from saved')
        }
      } else {
        // For inline stars, save directly without modal
        starBtn.innerHTML = '...'
        const success = await saveBookmark(entity, null)
        if (success) {
          starBtn.classList.add('wm-starred')
          starBtn.innerHTML = '⭐'
          starBtn.title = 'Remove from West Marches'
          showToast('Saved to West Marches!')
        } else {
          starBtn.innerHTML = '☆'
          showToast('Failed to save - are you logged in?')
        }
      }
    })
    
    // Insert star button after the link
    link.parentNode.insertBefore(starBtn, link.nextSibling)
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Also create star button after init (and on navigation)
setTimeout(() => {
  createStarButton()
  addInlineStarButtons()
}, 1500)

// Watch for SPA navigation and dynamic content
let lastUrl = location.href
new MutationObserver(() => {
  // URL change - full reset
  if (location.href !== lastUrl) {
    lastUrl = location.href
    // Remove old star button
    const oldBtn = document.getElementById('wm-star-btn')
    if (oldBtn) oldBtn.remove()
    // Create new ones after page settles
    setTimeout(() => {
      createStarButton()
      addInlineStarButtons()
    }, 1500)
  } else {
    // Same URL but DOM changed - check for new list items (debounced)
    clearTimeout(window.wmInlineStarTimeout)
    window.wmInlineStarTimeout = setTimeout(addInlineStarButtons, 500)
  }
}).observe(document.body, { subtree: true, childList: true })

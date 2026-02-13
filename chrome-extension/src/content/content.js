// West Marches Extension - Content Script
// Injected into D&D Beyond pages

let commandPaletteOpen = false
let sidebarOpen = false
let currentUser = null

// Initialize
async function init() {
  // Get current user
  const result = await chrome.storage.local.get(['user'])
  currentUser = result.user
  
  // Create UI containers
  createCommandPalette()
  createSidebar()
  createQuickActionButton()
  
  console.log('West Marches extension loaded on D&D Beyond')
}

// ============================================
// Command Palette (Cmd+K)
// ============================================

function createCommandPalette() {
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
  // Show quick actions when palette opens with no search
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
  
  // Store actions for selection
  container.dataset.actions = JSON.stringify(quickActions.map(a => a.action.toString()))
  
  // Click handlers
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
  
  // D&D Beyond navigation
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
  
  const matchingPages = ddbPages.filter(p => p.label.toLowerCase().includes(q))
  
  // West Marches navigation
  const wmPages = [
    { icon: '🗺️', label: 'WM: Map', url: 'https://westmarches-dnd.web.app/map' },
    { icon: '📖', label: 'WM: Sessions', url: 'https://westmarches-dnd.web.app/sessions' },
    { icon: '👤', label: 'WM: NPCs', url: 'https://westmarches-dnd.web.app/npcs' },
    { icon: '🏰', label: 'WM: Locations', url: 'https://westmarches-dnd.web.app/locations' },
    { icon: '📅', label: 'WM: Calendar', url: 'https://westmarches-dnd.web.app/calendar' },
    { icon: '⚔️', label: 'WM: Missions', url: 'https://westmarches-dnd.web.app/missions' },
  ]
  
  const matchingWmPages = wmPages.filter(p => p.label.toLowerCase().includes(q))
  
  // Search results HTML
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
  
  if (html === '') {
    html = '<div class="wm-no-results">No results found</div>'
  }
  
  container.innerHTML = html
  
  // Click handlers
  container.querySelectorAll('.wm-result-item').forEach((item) => {
    item.addEventListener('click', () => {
      const url = item.dataset.url
      if (url.startsWith('http')) {
        window.open(url, '_blank')
      } else {
        window.location.href = url
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
  if (selected) {
    selected.click()
  }
}

// ============================================
// Sidebar (Map + Quick Actions)
// ============================================

function createSidebar() {
  const sidebar = document.createElement('div')
  sidebar.id = 'wm-sidebar'
  sidebar.className = 'wm-sidebar wm-hidden'
  sidebar.innerHTML = `
    <div class="wm-sidebar-header">
      <span class="wm-sidebar-title">🗺️ West Marches</span>
      <button class="wm-sidebar-close">✕</button>
    </div>
    <div class="wm-sidebar-tabs">
      <button class="wm-tab wm-tab-active" data-tab="map">Map</button>
      <button class="wm-tab" data-tab="quick">Quick Add</button>
    </div>
    <div class="wm-sidebar-content">
      <div class="wm-tab-panel wm-tab-panel-active" data-panel="map">
        <iframe src="https://westmarches-dnd.web.app/map?embed=true" class="wm-map-iframe"></iframe>
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
  
  // Event listeners
  sidebar.querySelector('.wm-sidebar-close').addEventListener('click', () => toggleSidebar(false))
  
  sidebar.querySelectorAll('.wm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      sidebar.querySelectorAll('.wm-tab').forEach(t => t.classList.remove('wm-tab-active'))
      sidebar.querySelectorAll('.wm-tab-panel').forEach(p => p.classList.remove('wm-tab-panel-active'))
      tab.classList.add('wm-tab-active')
      sidebar.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('wm-tab-panel-active')
    })
  })
  
  sidebar.querySelector('#wm-quick-npc').addEventListener('click', showQuickNpcModal)
  sidebar.querySelector('#wm-quick-note').addEventListener('click', showQuickNoteModal)
  sidebar.querySelector('#wm-quick-marker').addEventListener('click', showQuickMarkerModal)
}

function toggleSidebar(show = !sidebarOpen) {
  sidebarOpen = show
  const sidebar = document.getElementById('wm-sidebar')
  if (!sidebar) return
  
  if (show) {
    sidebar.classList.remove('wm-hidden')
  } else {
    sidebar.classList.add('wm-hidden')
  }
}

// ============================================
// Quick Action Button (floating)
// ============================================

function createQuickActionButton() {
  const btn = document.createElement('button')
  btn.id = 'wm-quick-btn'
  btn.className = 'wm-quick-action-btn'
  btn.innerHTML = '🐉'
  btn.title = 'West Marches (Ctrl+K)'
  document.body.appendChild(btn)
  
  btn.addEventListener('click', () => toggleCommandPalette(true))
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
    
    // For now, just copy to clipboard and show toast
    // TODO: Save to Firestore scratchpad collection
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
  } else if (request.action === 'authStateChanged') {
    currentUser = request.user
  }
})

// Keyboard shortcuts (backup if commands don't work)
document.addEventListener('keydown', (e) => {
  // Cmd/Ctrl + K for command palette
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    toggleCommandPalette()
  }
  // Escape to close
  if (e.key === 'Escape') {
    if (commandPaletteOpen) toggleCommandPalette(false)
    if (sidebarOpen) toggleSidebar(false)
  }
})

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

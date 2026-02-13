import { LitElement, html, css, PropertyValues } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import { firestore } from '../api/firestore'

interface HexCoord { x: number; y: number }
interface Camera { x: number; y: number; zoom: number }

interface Location {
  id: string
  name: string
  type: string
  hexKey?: string
  description?: string
  hidden?: boolean
}

interface Feature {
  id: string
  name: string
  type: string
  hexKey?: string
  locationId?: string
  description?: string
  hidden?: boolean
}

interface HexNote {
  id: string
  hexKey: string
  content: string
  isPrivate: boolean
  authorName: string
  userId: string
}

const MAP_CONFIG = { gridW: 50, gridH: 50, hexSize: 30 }

@customElement('wm-map')
export class WmMap extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --wm-accent: #ef233c;
      --wm-bg: #1a1a1a;
      --wm-bg-secondary: #252525;
      --wm-text: #e4e4e4;
      --wm-text-muted: #888;
      --wm-border: rgba(255, 255, 255, 0.1);
    }

    .container {
      display: flex;
      width: 100%;
      height: 100%;
      background: var(--wm-bg);
      color: var(--wm-text);
      position: relative;
      overflow: hidden;
    }

    .map-area {
      flex: 1;
      position: relative;
      min-width: 0;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }

    canvas:active {
      cursor: grabbing;
    }

    .controls {
      position: absolute;
      top: 12px;
      left: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 10;
    }

    .control-btn {
      width: 36px;
      height: 36px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      color: var(--wm-text);
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .control-btn:hover {
      background: rgba(239, 35, 60, 0.2);
      border-color: var(--wm-accent);
    }

    .hex-info {
      position: absolute;
      top: 12px;
      right: 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      z-index: 10;
    }

    .hex-info .coords {
      color: var(--wm-accent);
      font-family: monospace;
    }

    /* Detail Panel */
    .detail-panel {
      width: 320px;
      background: var(--wm-bg);
      border-left: 1px solid var(--wm-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .detail-header {
      padding: 16px;
      border-bottom: 1px solid var(--wm-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .detail-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--wm-accent);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--wm-text-muted);
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
    }

    .close-btn:hover {
      color: var(--wm-text);
    }

    .detail-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--wm-text-muted);
      margin-bottom: 8px;
    }

    .item-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .item {
      padding: 10px 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .item:hover {
      border-color: var(--wm-accent);
    }

    .item-name {
      font-weight: 500;
    }

    .item-type {
      font-size: 11px;
      color: var(--wm-text-muted);
      margin-top: 2px;
    }

    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--wm-text-muted);
      font-size: 13px;
    }

    .add-btn {
      width: 100%;
      padding: 10px;
      background: rgba(239, 35, 60, 0.1);
      border: 1px dashed rgba(239, 35, 60, 0.3);
      border-radius: 8px;
      color: var(--wm-accent);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .add-btn:hover {
      background: rgba(239, 35, 60, 0.2);
      border-style: solid;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal {
      background: var(--wm-bg);
      border: 1px solid var(--wm-border);
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      padding: 16px;
      border-bottom: 1px solid var(--wm-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
    }

    .modal-body {
      padding: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      color: var(--wm-text-muted);
      margin-bottom: 6px;
    }

    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 10px 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      color: var(--wm-text);
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      border-color: var(--wm-accent);
    }

    .form-group textarea {
      resize: vertical;
      min-height: 80px;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--wm-border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn {
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }

    .btn-primary {
      background: var(--wm-accent);
      color: white;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-secondary {
      background: var(--wm-bg-secondary);
      color: var(--wm-text);
      border: 1px solid var(--wm-border);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .note {
      padding: 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .note-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .note-author {
      font-size: 12px;
      color: var(--wm-accent);
      font-weight: 500;
    }

    .note-private {
      font-size: 10px;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--wm-text-muted);
    }

    .note-content {
      font-size: 13px;
      line-height: 1.4;
    }
  `

  @property({ type: String }) authToken: string = ''
  @property({ type: String }) userId: string = ''
  @property({ type: String }) userName: string = 'Anonymous'
  @property({ type: Boolean }) isAdmin: boolean = false
  @property({ type: Boolean }) isDm: boolean = false

  @state() private selectedHex: HexCoord | null = null
  @state() private camera: Camera = { x: 25, y: 25, zoom: 1 }
  @state() private hexData: Record<string, any> = {}
  @state() private locations: Location[] = []
  @state() private features: Feature[] = []
  @state() private hexNotes: HexNote[] = []
  @state() private loading = true
  @state() private modalType: 'location' | 'feature' | 'note' | null = null

  @query('canvas') canvas!: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null = null
  private dpr = 1
  private isPanning = false
  private lastMouse = { x: 0, y: 0 }

  // Terrain colors (simplified)
  private terrainColors: Record<number, string> = {
    1: '#4a90d9', // Water
    2: '#c4b998', // Pale
    3: '#2d5a27', // Forest
    4: '#6b6b6b', // Mountain
    5: '#5a6b4a', // Swamp
    6: '#8fbc8f', // Plains
    7: '#9a8b7a', // Foothills
    9: '#2a5a8a', // Deep Water
    10: '#7cba7c', // Grass
    11: '#5a8a5a', // Dark Grass
    12: '#1a3a1a', // Dark Forest
  }

  connectedCallback() {
    super.connectedCallback()
    if (this.authToken) {
      firestore.setToken(this.authToken)
    }
    this.loadData()
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('authToken') && this.authToken) {
      firestore.setToken(this.authToken)
    }
  }

  firstUpdated() {
    this.setupCanvas()
    this.setupInputListeners()
    this.draw()
  }

  private async loadData() {
    this.loading = true
    try {
      const [mapDoc, locs, feats] = await Promise.all([
        firestore.getDocument('maps', 'world'),
        firestore.listDocuments('locations'),
        firestore.listDocuments('features')
      ])
      
      if (mapDoc?.hexes) {
        this.hexData = mapDoc.hexes
      }
      this.locations = locs.filter((l: any) => !l.hidden || this.isAdmin || this.isDm) as Location[]
      this.features = feats.filter((f: any) => !f.hidden || this.isAdmin || this.isDm) as Feature[]
    } catch (e) {
      console.error('Failed to load map data:', e)
    }
    this.loading = false
    this.draw()
  }

  private async loadHexNotes(hexKey: string) {
    try {
      const notes = await firestore.listDocuments('hexNotes')
      this.hexNotes = notes.filter((n: any) => {
        if (n.hexKey !== hexKey) return false
        if (n.isPrivate && n.userId !== this.userId && !this.isAdmin && !this.isDm) return false
        return true
      }) as HexNote[]
    } catch (e) {
      console.error('Failed to load hex notes:', e)
      this.hexNotes = []
    }
  }

  private setupCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = window.devicePixelRatio || 1
    this.canvas.width = rect.width * this.dpr
    this.canvas.height = rect.height * this.dpr
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.scale(this.dpr, this.dpr)
  }

  private setupInputListeners() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this))
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false })
    this.canvas.addEventListener('click', this.onClick.bind(this))

    // Touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false })
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false })
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this))
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0 || e.button === 2) {
      this.isPanning = true
      this.lastMouse = { x: e.clientX, y: e.clientY }
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.isPanning) {
      const dx = e.clientX - this.lastMouse.x
      const dy = e.clientY - this.lastMouse.y
      this.camera.x -= dx / (MAP_CONFIG.hexSize * this.camera.zoom)
      this.camera.y -= dy / (MAP_CONFIG.hexSize * this.camera.zoom)
      this.lastMouse = { x: e.clientX, y: e.clientY }
      this.draw()
    }
  }

  private onMouseUp() {
    this.isPanning = false
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    this.camera.zoom = Math.max(0.3, Math.min(5, this.camera.zoom * zoomFactor))
    this.draw()
  }

  private onClick(e: MouseEvent) {
    if (this.isPanning) return
    const hex = this.screenToHex(e.offsetX, e.offsetY)
    if (hex.x >= 0 && hex.x < MAP_CONFIG.gridW && hex.y >= 0 && hex.y < MAP_CONFIG.gridH) {
      this.selectedHex = hex
      this.loadHexNotes(`${hex.x}_${hex.y}`)
    }
  }

  private onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.preventDefault()
      const touch = e.touches[0]!
      this.isPanning = true
      this.lastMouse = { x: touch.clientX, y: touch.clientY }
    }
  }

  private onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1 && this.isPanning) {
      e.preventDefault()
      const touch = e.touches[0]!
      const dx = touch.clientX - this.lastMouse.x
      const dy = touch.clientY - this.lastMouse.y
      this.camera.x -= dx / (MAP_CONFIG.hexSize * this.camera.zoom)
      this.camera.y -= dy / (MAP_CONFIG.hexSize * this.camera.zoom)
      this.lastMouse = { x: touch.clientX, y: touch.clientY }
      this.draw()
    }
  }

  private onTouchEnd() {
    this.isPanning = false
  }

  private screenToHex(screenX: number, screenY: number): HexCoord {
    const size = MAP_CONFIG.hexSize * this.camera.zoom
    const rect = this.canvas.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const worldX = (screenX - centerX) / size + this.camera.x
    const worldY = (screenY - centerY) / size + this.camera.y

    // Offset coordinates for pointy-top hexes
    const q = (worldX * Math.sqrt(3) / 3 - worldY / 3) / 0.866
    const r = worldY * 2 / 3 / 0.866

    // Round to nearest hex
    let x = Math.round(q)
    let y = Math.round(r)

    return { x, y }
  }

  private hexToScreen(hx: number, hy: number): { x: number; y: number } {
    const size = MAP_CONFIG.hexSize * this.camera.zoom
    const rect = this.canvas.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Offset coordinates for pointy-top hexes
    const x = size * 0.866 * (hx + 0.5 * (hy & 1))
    const y = size * 0.75 * hy

    return {
      x: (x - this.camera.x * size + centerX),
      y: (y - this.camera.y * size + centerY)
    }
  }

  private draw() {
    if (!this.ctx) return
    const ctx = this.ctx
    const rect = this.canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)

    const size = MAP_CONFIG.hexSize * this.camera.zoom

    // Draw hexes
    for (let y = 0; y < MAP_CONFIG.gridH; y++) {
      for (let x = 0; x < MAP_CONFIG.gridW; x++) {
        const screen = this.hexToScreen(x, y)
        
        // Skip if off screen
        if (screen.x < -size * 2 || screen.x > width + size * 2) continue
        if (screen.y < -size * 2 || screen.y > height + size * 2) continue

        const hexKey = `${x}_${y}`
        const data = this.hexData[hexKey]
        const terrainType = data?.type || 10

        // Draw hex
        this.drawHex(ctx, screen.x, screen.y, size * 0.9, this.terrainColors[terrainType] || '#444')

        // Highlight selected
        if (this.selectedHex?.x === x && this.selectedHex?.y === y) {
          this.drawHex(ctx, screen.x, screen.y, size * 0.9, 'rgba(239, 35, 60, 0.3)', true)
        }
      }
    }

    // Draw location markers
    for (const loc of this.locations) {
      if (!loc.hexKey) continue
      const [hx, hy] = loc.hexKey.split('_').map(Number)
      const screen = this.hexToScreen(hx!, hy!)
      this.drawMarker(ctx, screen.x, screen.y, '🏰', size * 0.4)
    }

    // Draw feature markers
    for (const feat of this.features) {
      if (!feat.hexKey) continue
      const [hx, hy] = feat.hexKey.split('_').map(Number)
      const screen = this.hexToScreen(hx!, hy!)
      this.drawMarker(ctx, screen.x, screen.y - size * 0.3, '📍', size * 0.3)
    }
  }

  private drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, strokeOnly = false) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30)
      const px = x + size * Math.cos(angle)
      const py = y + size * Math.sin(angle)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()

    if (strokeOnly) {
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.stroke()
    } else {
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, size: number) {
    ctx.font = `${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, x, y)
  }

  private zoomIn() {
    this.camera.zoom = Math.min(5, this.camera.zoom * 1.2)
    this.draw()
  }

  private zoomOut() {
    this.camera.zoom = Math.max(0.3, this.camera.zoom / 1.2)
    this.draw()
  }

  private closePanel() {
    this.selectedHex = null
    this.hexNotes = []
  }

  private getLocationsInHex(hexKey: string): Location[] {
    return this.locations.filter(l => l.hexKey === hexKey)
  }

  private getFeaturesInHex(hexKey: string): Feature[] {
    return this.features.filter(f => f.hexKey === hexKey)
  }

  private openModal(type: 'location' | 'feature' | 'note') {
    this.modalType = type
  }

  private closeModal() {
    this.modalType = null
  }

  private async saveLocation(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const data = {
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      description: formData.get('description') as string,
      hexKey: this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null,
      hidden: formData.get('hidden') === 'on',
      createdAt: new Date().toISOString()
    }

    const result = await firestore.createDocument('locations', data)
    if (result) {
      this.locations = [...this.locations, result as Location]
      this.closeModal()
      this.draw()
    }
  }

  private async saveFeature(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const data = {
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      description: formData.get('description') as string,
      hexKey: this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null,
      hidden: formData.get('hidden') === 'on',
      createdAt: new Date().toISOString()
    }

    const result = await firestore.createDocument('features', data)
    if (result) {
      this.features = [...this.features, result as Feature]
      this.closeModal()
      this.draw()
    }
  }

  private async saveNote(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const data = {
      content: formData.get('content') as string,
      isPrivate: formData.get('isPrivate') === 'on',
      hexKey: this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : '',
      userId: this.userId,
      authorName: this.userName,
      createdAt: new Date().toISOString()
    }

    const result = await firestore.createDocument('hexNotes', data)
    if (result) {
      this.hexNotes = [...this.hexNotes, result as HexNote]
      this.closeModal()
    }
  }

  render() {
    const hexKey = this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null
    const hexLocations = hexKey ? this.getLocationsInHex(hexKey) : []
    const hexFeatures = hexKey ? this.getFeaturesInHex(hexKey) : []

    return html`
      <div class="container">
        <div class="map-area">
          <canvas></canvas>
          
          <div class="controls">
            <button class="control-btn" @click=${this.zoomIn}>+</button>
            <button class="control-btn" @click=${this.zoomOut}>−</button>
          </div>

          ${this.selectedHex ? html`
            <div class="hex-info">
              Hex: <span class="coords">${this.selectedHex.x}, ${this.selectedHex.y}</span>
            </div>
          ` : ''}
        </div>

        ${this.selectedHex ? html`
          <div class="detail-panel">
            <div class="detail-header">
              <span class="detail-title">Hex ${this.selectedHex.x}, ${this.selectedHex.y}</span>
              <button class="close-btn" @click=${this.closePanel}>✕</button>
            </div>
            <div class="detail-content">
              <!-- Locations -->
              <div class="section">
                <div class="section-title">🏰 Locations</div>
                ${hexLocations.length > 0 ? html`
                  <div class="item-list">
                    ${hexLocations.map(loc => html`
                      <div class="item">
                        <div class="item-name">${loc.name}</div>
                        <div class="item-type">${loc.type}</div>
                      </div>
                    `)}
                  </div>
                ` : html`<div class="empty-state">No locations</div>`}
                <button class="add-btn" @click=${() => this.openModal('location')}>+ Add Location</button>
              </div>

              <!-- Features -->
              <div class="section">
                <div class="section-title">📍 Points of Interest</div>
                ${hexFeatures.length > 0 ? html`
                  <div class="item-list">
                    ${hexFeatures.map(feat => html`
                      <div class="item">
                        <div class="item-name">${feat.name}</div>
                        <div class="item-type">${feat.type}</div>
                      </div>
                    `)}
                  </div>
                ` : html`<div class="empty-state">No features</div>`}
                <button class="add-btn" @click=${() => this.openModal('feature')}>+ Add Feature</button>
              </div>

              <!-- Notes -->
              <div class="section">
                <div class="section-title">📝 Notes</div>
                ${this.hexNotes.length > 0 ? html`
                  ${this.hexNotes.map(note => html`
                    <div class="note">
                      <div class="note-header">
                        <span class="note-author">${note.authorName}</span>
                        ${note.isPrivate ? html`<span class="note-private">Private</span>` : ''}
                      </div>
                      <div class="note-content">${note.content}</div>
                    </div>
                  `)}
                ` : html`<div class="empty-state">No notes</div>`}
                <button class="add-btn" @click=${() => this.openModal('note')}>+ Add Note</button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Modals -->
        ${this.modalType === 'location' ? html`
          <div class="modal-backdrop" @click=${this.closeModal}>
            <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
              <div class="modal-header">
                <span class="modal-title">Add Location</span>
                <button class="close-btn" @click=${this.closeModal}>✕</button>
              </div>
              <form @submit=${this.saveLocation}>
                <div class="modal-body">
                  <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" required placeholder="Location name...">
                  </div>
                  <div class="form-group">
                    <label>Type</label>
                    <select name="type">
                      <option value="city">City</option>
                      <option value="town">Town</option>
                      <option value="village">Village</option>
                      <option value="castle">Castle</option>
                      <option value="fortress">Fortress</option>
                      <option value="ruins">Ruins</option>
                      <option value="camp">Camp</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" placeholder="Description..."></textarea>
                  </div>
                  ${this.isAdmin || this.isDm ? html`
                    <div class="form-group">
                      <label class="checkbox-row">
                        <input type="checkbox" name="hidden">
                        Hidden from players
                      </label>
                    </div>
                  ` : ''}
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click=${this.closeModal}>Cancel</button>
                  <button type="submit" class="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        ` : ''}

        ${this.modalType === 'feature' ? html`
          <div class="modal-backdrop" @click=${this.closeModal}>
            <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
              <div class="modal-header">
                <span class="modal-title">Add Point of Interest</span>
                <button class="close-btn" @click=${this.closeModal}>✕</button>
              </div>
              <form @submit=${this.saveFeature}>
                <div class="modal-body">
                  <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" required placeholder="Feature name...">
                  </div>
                  <div class="form-group">
                    <label>Type</label>
                    <select name="type">
                      <option value="inn">Inn</option>
                      <option value="tavern">Tavern</option>
                      <option value="shop">Shop</option>
                      <option value="temple">Temple</option>
                      <option value="shrine">Shrine</option>
                      <option value="blacksmith">Blacksmith</option>
                      <option value="guild">Guild</option>
                      <option value="cave">Cave</option>
                      <option value="ruins">Ruins</option>
                      <option value="monument">Monument</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" placeholder="Description..."></textarea>
                  </div>
                  ${this.isAdmin || this.isDm ? html`
                    <div class="form-group">
                      <label class="checkbox-row">
                        <input type="checkbox" name="hidden">
                        Hidden from players
                      </label>
                    </div>
                  ` : ''}
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click=${this.closeModal}>Cancel</button>
                  <button type="submit" class="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        ` : ''}

        ${this.modalType === 'note' ? html`
          <div class="modal-backdrop" @click=${this.closeModal}>
            <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
              <div class="modal-header">
                <span class="modal-title">Add Note</span>
                <button class="close-btn" @click=${this.closeModal}>✕</button>
              </div>
              <form @submit=${this.saveNote}>
                <div class="modal-body">
                  <div class="form-group">
                    <label>Note</label>
                    <textarea name="content" required placeholder="Write your note..."></textarea>
                  </div>
                  <div class="form-group">
                    <label class="checkbox-row">
                      <input type="checkbox" name="isPrivate">
                      Private (only visible to you and DMs)
                    </label>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click=${this.closeModal}>Cancel</button>
                  <button type="submit" class="btn btn-primary">Save Note</button>
                </div>
              </form>
            </div>
          </div>
        ` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wm-map': WmMap
  }
}

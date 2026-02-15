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

// Match Vue app's config
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

    .loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--wm-accent);
    }

    .zoom-indicator {
      position: absolute;
      bottom: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.6);
      color: var(--wm-text-muted);
      font-size: 12px;
      font-family: monospace;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--wm-border);
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

    .terrain-badge {
      display: inline-block;
      padding: 4px 8px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 4px;
      font-size: 12px;
      margin-bottom: 12px;
    }
  `

  @property({ type: String }) authToken: string = ''
  @property({ type: String }) userId: string = ''
  @property({ type: String }) userName: string = 'Anonymous'
  @property({ type: Boolean }) isAdmin: boolean = false
  @property({ type: Boolean }) isDm: boolean = false

  @state() private selectedHex: HexCoord | null = null
  @state() private camera: Camera = { x: 50, y: 50, zoom: 1 }
  @state() private hexData: Record<string, any> = {}
  @state() private locations: Location[] = []
  @state() private features: Feature[] = []
  @state() private hexNotes: HexNote[] = []
  @state() private loading = true
  @state() private terrainConfig: Record<number, { name: string; color: string; texture?: string }> = {}
  @state() private markerTypesConfig: {
    locationTypes: Record<string, { label: string; iconUrl: string }>;
    featureTypes: Record<string, { label: string; iconUrl: string }>;
  } = { locationTypes: {}, featureTypes: {} }

  @query('canvas') canvas!: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null = null
  private dpr = 1
  private isPanning = false
  private hasMoved = false
  private lastMouse = { x: 0, y: 0 }
  private animationId: number | null = null
  
  // Touch/pinch state
  private initialPinchDist: number | null = null
  private initialPinchZoom: number = 1
  private touchStartPos: { x: number; y: number } | null = null
  
  // Loaded images
  private terrainImages: Record<number, HTMLImageElement> = {}
  private iconImages: Record<string, HTMLImageElement> = {}

  // Default terrain colors (fallback if config not loaded)
  private defaultTerrainColors: Record<number, string> = {
    1: '#4a90d9',   // Water
    2: '#c4b998',   // Pale/Desert
    3: '#2d5a27',   // Forest
    4: '#6b6b6b',   // Mountain
    5: '#5a6b4a',   // Swamp
    6: '#8fbc8f',   // Plains
    7: '#9a8b7a',   // Foothills
    9: '#2a5a8a',   // Deep Water
    10: '#7cba7c',  // Grass
    11: '#5a8a5a',  // Dark Grass
    12: '#1a3a1a',  // Dark Forest
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
    this.fitToView()
    this.draw()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
  }

  private async loadData() {
    this.loading = true
    console.log('[wm-map] loadData starting, authToken:', this.authToken ? 'present' : 'missing')
    try {
      const [mapDoc, locs, feats] = await Promise.all([
        firestore.getDocument('maps', 'world'),
        firestore.listDocuments('locations'),
        firestore.listDocuments('features')
      ])
      
      console.log('[wm-map] mapDoc:', mapDoc ? 'loaded' : 'null')
      
      if (mapDoc?.hexes) {
        this.hexData = mapDoc.hexes
        // Debug: log first few keys
        const keys = Object.keys(this.hexData).slice(0, 10)
        console.log('[wm-map] HexData sample keys:', keys)
        console.log('[wm-map] Sample hex 1_1:', this.hexData['1_1'])
        console.log('[wm-map] Sample hex 0_0:', this.hexData['0_0'])
        console.log('[wm-map] Total hexes:', Object.keys(this.hexData).length)
      } else {
        console.log('[wm-map] No hexes in mapDoc')
      }
      this.locations = locs.filter((l: any) => !l.hidden || this.isAdmin || this.isDm) as Location[]
      this.features = feats.filter((f: any) => !f.hidden || this.isAdmin || this.isDm) as Feature[]
      
      // Load terrain config from config/terrain document
      try {
        const terrainDoc = await firestore.getDocument('config', 'terrain')
        if (terrainDoc) {
          // terrain doc has keys like "1", "2", etc. with name, color, texture
          for (const [key, value] of Object.entries(terrainDoc)) {
            if (key === 'id') continue
            const id = parseInt(key)
            if (!isNaN(id) && typeof value === 'object') {
              const v = value as any
              this.terrainConfig[id] = { 
                name: v.name || `Terrain ${id}`, 
                color: v.color || '#666',
                texture: v.texture
              }
            }
          }
          console.log('[wm-map] Loaded terrain config:', Object.keys(this.terrainConfig).length, 'types')
          this.loadTerrainImages()
        }
      } catch (e) {
        console.log('[wm-map] Using default terrain colors')
      }
      
      // Load marker types config
      try {
        const markerTypesDoc = await firestore.getDocument('config', 'markerTypes')
        if (markerTypesDoc) {
          this.markerTypesConfig = {
            locationTypes: markerTypesDoc.locationTypes || {},
            featureTypes: markerTypesDoc.featureTypes || {}
          }
          console.log('[wm-map] Loaded marker types config')
          this.loadIconImages()
        }
      } catch (e) {
        console.log('[wm-map] Using default icons')
      }
    } catch (e) {
      console.error('Failed to load map data:', e)
    }
    this.loading = false
    this.draw()
  }

  private loadTerrainImages() {
    for (const [idStr, config] of Object.entries(this.terrainConfig)) {
      const id = parseInt(idStr)
      if (config.texture) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          this.terrainImages[id] = img
          this.requestDraw()
        }
        img.src = config.texture
      }
    }
  }

  private loadIconImages() {
    // Load location type icons
    for (const [key, entry] of Object.entries(this.markerTypesConfig.locationTypes)) {
      if (entry.iconUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          this.iconImages[`loc:${key}`] = img
          this.requestDraw()
        }
        img.src = entry.iconUrl
      }
    }
    // Load feature type icons
    for (const [key, entry] of Object.entries(this.markerTypesConfig.featureTypes)) {
      if (entry.iconUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          this.iconImages[`feat:${key}`] = img
          this.requestDraw()
        }
        img.src = entry.iconUrl
      }
    }
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
    
    // Observe resize
    const resizeObserver = new ResizeObserver(() => {
      const newRect = this.canvas.getBoundingClientRect()
      this.canvas.width = newRect.width * this.dpr
      this.canvas.height = newRect.height * this.dpr
      this.ctx = this.canvas.getContext('2d')!
      this.ctx.scale(this.dpr, this.dpr)
      this.draw()
    })
    resizeObserver.observe(this.canvas)
  }

  private setupInputListeners() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this))
    this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this))
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
      this.hasMoved = false
      this.lastMouse = { x: e.clientX, y: e.clientY }
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.isPanning) {
      const dx = e.clientX - this.lastMouse.x
      const dy = e.clientY - this.lastMouse.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.hasMoved = true
      }
      this.camera.x += dx
      this.camera.y += dy
      this.lastMouse = { x: e.clientX, y: e.clientY }
      this.requestDraw()
    }
  }

  private onMouseUp() {
    this.isPanning = false
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.3, Math.min(5, this.camera.zoom * zoomFactor))
    
    // Zoom towards mouse position
    const worldX = (mouseX - this.camera.x) / this.camera.zoom
    const worldY = (mouseY - this.camera.y) / this.camera.zoom
    
    this.camera.zoom = newZoom
    this.camera.x = mouseX - worldX * newZoom
    this.camera.y = mouseY - worldY * newZoom
    
    this.requestDraw()
  }

  private onClick(e: MouseEvent) {
    // Don't select hex if we were dragging
    if (this.hasMoved) return
    
    const hex = this.getHexAt(e.offsetX, e.offsetY)
    console.log('[wm-map] Click at', e.offsetX, e.offsetY, '-> hex:', hex)
    if (hex && hex.x >= 1 && hex.x <= MAP_CONFIG.gridW && hex.y >= 1 && hex.y <= MAP_CONFIG.gridH) {
      this.selectedHex = hex
      this.loadHexNotes(`${hex.x}_${hex.y}`)
      this.requestDraw()
    }
  }

  private onTouchStart(e: TouchEvent) {
    e.preventDefault()
    
    if (e.touches.length === 1) {
      const touch = e.touches[0]!
      this.isPanning = true
      this.hasMoved = false
      this.lastMouse = { x: touch.clientX, y: touch.clientY }
      this.touchStartPos = { x: touch.clientX, y: touch.clientY }
    } else if (e.touches.length === 2) {
      // Pinch zoom start
      this.isPanning = false
      const t1 = e.touches[0]!
      const t2 = e.touches[1]!
      this.initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      this.initialPinchZoom = this.camera.zoom
    }
  }

  private onTouchMove(e: TouchEvent) {
    e.preventDefault()
    
    if (e.touches.length === 1 && this.isPanning) {
      const touch = e.touches[0]!
      const dx = touch.clientX - this.lastMouse.x
      const dy = touch.clientY - this.lastMouse.y
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.hasMoved = true
      }
      
      this.camera.x += dx
      this.camera.y += dy
      this.lastMouse = { x: touch.clientX, y: touch.clientY }
      this.requestDraw()
    } else if (e.touches.length === 2 && this.initialPinchDist) {
      // Pinch zoom
      const t1 = e.touches[0]!
      const t2 = e.touches[1]!
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const scale = dist / this.initialPinchDist
      
      // Calculate pinch center
      const rect = this.canvas.getBoundingClientRect()
      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left
      const centerY = (t1.clientY + t2.clientY) / 2 - rect.top
      
      const newZoom = Math.max(0.3, Math.min(5, this.initialPinchZoom * scale))
      
      // Zoom towards pinch center
      const worldX = (centerX - this.camera.x) / this.camera.zoom
      const worldY = (centerY - this.camera.y) / this.camera.zoom
      
      this.camera.zoom = newZoom
      this.camera.x = centerX - worldX * newZoom
      this.camera.y = centerY - worldY * newZoom
      
      this.hasMoved = true
      this.requestDraw()
    }
  }

  private onTouchEnd(e: TouchEvent) {
    // Tap to select hex (if didn't move)
    if (!this.hasMoved && this.touchStartPos && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]!
      const rect = this.canvas.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      
      const hex = this.getHexAt(x, y)
      if (hex && hex.x >= 1 && hex.x <= MAP_CONFIG.gridW && hex.y >= 1 && hex.y <= MAP_CONFIG.gridH) {
        this.selectedHex = hex
        this.loadHexNotes(`${hex.x}_${hex.y}`)
        this.requestDraw()
      }
    }
    
    this.isPanning = false
    this.initialPinchDist = null
    this.touchStartPos = null
  }

  // Match Vue's getHexCenter: flat-top hexes with offset coordinates
  private getHexCenter(col: number, row: number): { x: number; y: number } {
    const size = MAP_CONFIG.hexSize
    const c = col - 1  // 0-indexed
    const r = row - 1
    const x = c * 1.5 * size + size * 2
    const yOffset = (c % 2) * ((Math.sqrt(3) * size) / 2)
    const y = r * Math.sqrt(3) * size + yOffset + size * 2
    return { x, y }
  }

  private toWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.camera.x) / this.camera.zoom,
      y: (screenY - this.camera.y) / this.camera.zoom,
    }
  }

  private getHexAt(screenX: number, screenY: number): HexCoord | null {
    const world = this.toWorld(screenX, screenY)
    let closestHex: HexCoord | null = null
    let minDistance = Infinity
    
    for (let col = 1; col <= MAP_CONFIG.gridW; col++) {
      for (let row = 1; row <= MAP_CONFIG.gridH; row++) {
        const center = this.getHexCenter(col, row)
        const dist = Math.sqrt((world.x - center.x) ** 2 + (world.y - center.y) ** 2)
        if (dist <= MAP_CONFIG.hexSize * 1.1 && dist < minDistance) {
          minDistance = dist
          closestHex = { x: col, y: row }
        }
      }
    }
    return closestHex
  }

  private fitToView() {
    const rect = this.canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const size = MAP_CONFIG.hexSize
    const bottomRight = this.getHexCenter(MAP_CONFIG.gridW, MAP_CONFIG.gridH)

    const mapLeft = -size * 2
    const mapTop = -size
    const mapRight = bottomRight.x + size * 2
    const mapBottom = bottomRight.y + size * 2
    const mapWidth = mapRight - mapLeft
    const mapHeight = mapBottom - mapTop

    const margin = 20
    const availW = rect.width - margin * 2
    const availH = rect.height - margin * 2
    const zoom = Math.min(availW / mapWidth, availH / mapHeight, 2.0)

    this.camera.zoom = zoom
    this.camera.x = margin - mapLeft * zoom
    this.camera.y = margin - mapTop * zoom
  }

  private requestDraw() {
    if (this.animationId) return
    this.animationId = requestAnimationFrame(() => {
      this.animationId = null
      this.draw()
    })
  }

  private draw() {
    if (!this.ctx) return
    const ctx = this.ctx
    const rect = this.canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    // Reset transform and clear entire canvas
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)

    // Save state and apply camera transform
    ctx.save()
    ctx.translate(this.camera.x, this.camera.y)
    ctx.scale(this.camera.zoom, this.camera.zoom)

    const size = MAP_CONFIG.hexSize

    // Draw hexes
    for (let col = 1; col <= MAP_CONFIG.gridW; col++) {
      for (let row = 1; row <= MAP_CONFIG.gridH; row++) {
        const center = this.getHexCenter(col, row)
        
        // Frustum culling
        const screenX = center.x * this.camera.zoom + this.camera.x
        const screenY = center.y * this.camera.zoom + this.camera.y
        if (screenX < -size * 2 || screenX > width + size * 2) continue
        if (screenY < -size * 2 || screenY > height + size * 2) continue

        const hexKey = `${col}_${row}`
        const data = this.hexData[hexKey]
        const terrainType = data?.type || 10

        // Get terrain color and image
        const color = this.terrainConfig[terrainType]?.color || 
                      this.defaultTerrainColors[terrainType] || '#444'
        const terrainImg = this.terrainImages[terrainType]

        // Draw flat-top hex with texture or color
        this.drawHex(ctx, center.x, center.y, size, color, terrainImg)

        // Highlight selected
        if (this.selectedHex?.x === col && this.selectedHex?.y === row) {
          this.drawHexHighlight(ctx, center.x, center.y, size)
        }
      }
    }

    // Draw hex indicators (locations, features) with zoom-based scaling
    this.drawHexIndicators(ctx, size)

    // Restore canvas state
    ctx.restore()
  }

  // Flat-top hex: vertices at angles 0°, 60°, 120°, 180°, 240°, 300°
  private drawHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, img?: HTMLImageElement) {
    const angle = (2 * Math.PI) / 6
    const drawSize = size * 1.02  // Slight overlap to avoid gaps

    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      // No rotation offset - flat-top hex starts at angle 0 (right vertex)
      const px = cx + drawSize * Math.cos(angle * i)
      const py = cy + drawSize * Math.sin(angle * i)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()

    if (img) {
      // Draw texture image clipped to hex
      ctx.save()
      ctx.clip()
      const imgSize = size * 2.1
      ctx.drawImage(img, cx - imgSize / 2, cy - imgSize / 2, imgSize, imgSize)
      ctx.restore()
    } else {
      ctx.fillStyle = color
      ctx.fill()
    }
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawHexHighlight(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
    const angle = (2 * Math.PI) / 6
    const drawSize = size * 1.02

    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const px = cx + drawSize * Math.cos(angle * i)
      const py = cy + drawSize * Math.sin(angle * i)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()

    ctx.strokeStyle = '#ef233c'
    ctx.lineWidth = 3
    ctx.stroke()
    
    ctx.fillStyle = 'rgba(239, 35, 60, 0.2)'
    ctx.fill()
  }

  private drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, size: number) {
    ctx.font = `${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, x, y)
  }

  private drawHexIndicators(ctx: CanvasRenderingContext2D, hexSize: number) {
    const zoom = this.camera.zoom

    // Determine how many icons to show based on zoom
    let maxIcons: number
    if (zoom >= 5.0) maxIcons = 7
    else if (zoom >= 3.0) maxIcons = 6
    else if (zoom >= 1.5) maxIcons = 3
    else maxIcons = 1

    // Group markers by hex
    const hexMarkers: Record<string, Array<{ kind: 'location' | 'feature'; type: string; name: string }>> = {}
    
    for (const loc of this.locations) {
      if (!loc.hexKey) continue
      if (!hexMarkers[loc.hexKey]) hexMarkers[loc.hexKey] = []
      hexMarkers[loc.hexKey].push({ kind: 'location', type: loc.type, name: loc.name })
    }
    
    for (const feat of this.features) {
      if (!feat.hexKey) continue
      if (!hexMarkers[feat.hexKey]) hexMarkers[feat.hexKey] = []
      hexMarkers[feat.hexKey].push({ kind: 'feature', type: feat.type, name: feat.name })
    }

    // Draw markers for each hex
    for (const [hexKey, markers] of Object.entries(hexMarkers)) {
      const [hx, hy] = hexKey.split('_').map(Number)
      if (!hx || !hy) continue
      
      const center = this.getHexCenter(hx, hy)
      const showCount = Math.min(markers.length, maxIcons)
      const iconsToShow = markers.slice(0, showCount)

      // Determine icon size based on count
      let iconDrawSize: number
      if (iconsToShow.length === 1) {
        iconDrawSize = hexSize * 1.6 * (zoom < 1.0 ? 1.0 : 0.8)
      } else if (iconsToShow.length <= 3) {
        iconDrawSize = hexSize * 0.7
      } else {
        iconDrawSize = hexSize * 0.5
      }

      // Get positions for icons
      const positions = this.getIconPositions(center.x, center.y, iconsToShow.length, hexSize)

      for (let i = 0; i < iconsToShow.length; i++) {
        const marker = iconsToShow[i]!
        const pos = positions[i]!
        
        // Try to get the icon image
        const imgKey = marker.kind === 'location' ? `loc:${marker.type}` : `feat:${marker.type}`
        const img = this.iconImages[imgKey]
        
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = 3
        
        if (img) {
          ctx.drawImage(img, pos.x - iconDrawSize / 2, pos.y - iconDrawSize / 2, iconDrawSize, iconDrawSize)
        } else {
          // Fallback emoji
          const emoji = marker.kind === 'location' ? '🏰' : '📍'
          ctx.font = `${iconDrawSize * 0.7}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(emoji, pos.x, pos.y)
        }
        
        ctx.restore()
      }
    }
  }

  private getIconPositions(cx: number, cy: number, count: number, hexSize: number): Array<{ x: number; y: number }> {
    if (count === 1) {
      return [{ x: cx, y: cy }]
    }
    
    const positions: Array<{ x: number; y: number }> = []
    const angle = (2 * Math.PI) / 6
    const dist = hexSize * 0.55
    
    // Place icons at hex corners
    for (let i = 0; i < count && i < 6; i++) {
      const cornerAngle = angle * i
      positions.push({
        x: cx + dist * Math.cos(cornerAngle),
        y: cy + dist * Math.sin(cornerAngle)
      })
    }
    
    // 7th icon goes in center
    if (count >= 7) {
      positions.push({ x: cx, y: cy })
    }
    
    return positions
  }

  private zoomIn() {
    this.camera.zoom = Math.min(5, this.camera.zoom * 1.2)
    this.requestDraw()
  }

  private zoomOut() {
    this.camera.zoom = Math.max(0.3, this.camera.zoom / 1.2)
    this.requestDraw()
  }

  private closePanel() {
    this.selectedHex = null
    this.hexNotes = []
    this.requestDraw()
  }

  private getLocationsInHex(hexKey: string): Location[] {
    return this.locations.filter(l => l.hexKey === hexKey)
  }

  private getFeaturesInHex(hexKey: string): Feature[] {
    return this.features.filter(f => f.hexKey === hexKey)
  }

  private getTerrainName(hexKey: string): string {
    const data = this.hexData[hexKey]
    const typeId = data?.type || 10
    return this.terrainConfig[typeId]?.name || `Terrain ${typeId}`
  }

  render() {
    const hexKey = this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null
    const hexLocations = hexKey ? this.getLocationsInHex(hexKey) : []
    const hexFeatures = hexKey ? this.getFeaturesInHex(hexKey) : []

    return html`
      <div class="container">
        <div class="map-area">
          ${this.loading ? html`<div class="loading">Loading map...</div>` : ''}
          <canvas></canvas>
          
          <div class="controls">
            <button class="control-btn" @click=${this.zoomIn}>+</button>
            <button class="control-btn" @click=${this.zoomOut}>−</button>
          </div>

          <div class="zoom-indicator">${this.camera.zoom.toFixed(2)}×</div>

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
              <div class="terrain-badge">${this.getTerrainName(hexKey!)}</div>

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
              </div>

              <!-- Notes -->
              <div class="section">
                <div class="section-title">📝 Notes (${this.hexNotes.length})</div>
                ${this.hexNotes.length > 0 ? html`
                  <div class="item-list">
                    ${this.hexNotes.map(note => html`
                      <div class="item">
                        <div class="item-name">${note.authorName}</div>
                        <div class="item-type">${note.content.slice(0, 100)}${note.content.length > 100 ? '...' : ''}</div>
                      </div>
                    `)}
                  </div>
                ` : html`<div class="empty-state">No notes</div>`}
              </div>
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

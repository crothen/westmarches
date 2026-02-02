export interface HexMapConfig {
  gridW: number
  gridH: number
  hexSize: number
}

export interface TerrainEntry {
  id: number
  color?: string
  texture?: string
  scale?: number
  name?: string
  [key: string]: any
}

export interface TagEntry {
  id: number
  texture?: string
  name?: string
  [key: string]: any
}

export interface HexData {
  type?: number | string
  mainTag?: number | string
  mainTagIsPrivate?: boolean
  tags?: (number | string)[]
  [key: string]: any
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface HexCoord {
  x: number
  y: number
}

export interface HexMarkerData {
  locationType?: string
  featureCount: number
  noteCount: number
  markerCount?: number
  markerTypes?: string[]  // marker types present in this hex
  hidden?: boolean  // true if ALL locations/features in this hex are hidden
  hasHiddenItems?: boolean  // true if ANY location/feature in this hex is hidden
}

export class HexMap {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  container: HTMLElement
  CONFIG: HexMapConfig

  TERRAIN_CONFIG: Record<string, TerrainEntry>
  TAGS_CONFIG: Record<string, TagEntry>

  terrainIdMap: Record<number, TerrainEntry & { name: string }>
  tagIdMap: Record<number, TagEntry & { name: string }>
  terrainNameMap: Record<string, number>
  tagNameMap: Record<string, number>

  camera: Camera
  loadedPatterns: Record<number, CanvasPattern | null>
  terrainImages: Record<number, HTMLImageElement>
  tagImages: Record<number, HTMLImageElement>
  /** Preloaded icon images for hex indicators (location/feature/marker types) */
  iconImages: Record<string, HTMLImageElement>
  imagesLoaded: number
  dpr: number

  // Input state
  isPanning: boolean
  isLeftMouseDown: boolean
  leftDownStart: { x: number; y: number }
  hasDragged: boolean
  lastMouse: { x: number; y: number }
  initialPinchDist: number | null
  initialCamZoom: number
  initialCamX: number
  initialCamY: number
  initialWorldX: number
  initialWorldY: number
  touchStartX: number
  touchStartY: number
  hasMoved: boolean

  // Callbacks
  onHexClick: ((hex: HexCoord | null, clientX: number, clientY: number, type: string) => void) | null
  onCameraChange: (() => void) | null

  // Bound listeners for cleanup
  private _boundResize: () => void
  private _boundMouseMove: (e: MouseEvent) => void
  private _boundMouseUp: () => void

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    config: HexMapConfig,
    terrainConfig: Record<string, TerrainEntry>,
    tagsConfig: Record<string, TagEntry>
  ) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.container = container

    this.CONFIG = config

    this.TERRAIN_CONFIG = terrainConfig || {}
    this.TAGS_CONFIG = tagsConfig || {}

    this.terrainIdMap = {} as any
    this.tagIdMap = {} as any
    this.terrainNameMap = {}
    this.tagNameMap = {}

    this.buildLookups()

    this.camera = { x: 50, y: 50, zoom: 1 }
    this.loadedPatterns = {}
    this.terrainImages = {}
    this.tagImages = {}
    this.iconImages = {}
    this.imagesLoaded = 0
    this.dpr = 1

    // Input state
    this.isPanning = false
    this.isLeftMouseDown = false
    this.leftDownStart = { x: 0, y: 0 }
    this.hasDragged = false
    this.lastMouse = { x: 0, y: 0 }
    this.initialPinchDist = null
    this.initialCamZoom = 1
    this.initialCamX = 0
    this.initialCamY = 0
    this.initialWorldX = 0
    this.initialWorldY = 0
    this.touchStartX = 0
    this.touchStartY = 0
    this.hasMoved = false

    this.onHexClick = null
    this.onCameraChange = null

    // Bound listeners for cleanup
    this._boundResize = () => this.resizeCanvas()
    this._boundMouseMove = (e: MouseEvent) => this.handleMouseMove(e)
    this._boundMouseUp = () => this.handleMouseUp()

    // Init
    this.resizeCanvas()
    window.addEventListener('resize', this._boundResize)
    this.setupInputListeners()
    this.loadTextures()
    this.loadIconImages()
  }

  /**
   * Preload PNG icon images for hex map indicators.
   */
  loadIconImages(): void {
    const iconPaths: Record<string, string> = {
      // Location types
      city: '/icons/locations/city.png',
      town: '/icons/locations/town.png',
      village: '/icons/locations/village.png',
      castle: '/icons/locations/castle.png',
      fortress: '/icons/locations/fortress.png',
      monastery: '/icons/locations/monastery.png',
      camp: '/icons/locations/camp.png',
      ruins: '/icons/locations/ruins.png',
      other: '/icons/locations/other.png',
      // Marker types
      clue: '/icons/markers/clue.png',
      battle: '/icons/markers/battle.png',
      danger: '/icons/markers/danger.png',
      puzzle: '/icons/markers/puzzle.png',
      mystery: '/icons/markers/mystery.png',
      waypoint: '/icons/markers/waypoint.png',
      quest: '/icons/markers/quest.png',
      locked: '/icons/markers/locked.png',
      unlocked: '/icons/markers/unlocked.png',
      // Feature fallback
      feature: '/icons/features/other.png',
    }

    for (const [key, path] of Object.entries(iconPaths)) {
      const img = new Image()
      img.src = path
      img.onload = () => {
        this.iconImages[key] = img
        this.requestDraw()
      }
      img.onerror = () => {
        console.warn(`Failed to load icon: ${path}`)
      }
    }
  }

  destroy(): void {
    window.removeEventListener('resize', this._boundResize)
    window.removeEventListener('mousemove', this._boundMouseMove)
    window.removeEventListener('mouseup', this._boundMouseUp)
  }

  buildLookups(): void {
    this.terrainIdMap = {} as any
    this.terrainNameMap = {}
    this.tagIdMap = {} as any
    this.tagNameMap = {}

    // Terrain
    if (this.TERRAIN_CONFIG) {
      Object.entries(this.TERRAIN_CONFIG).forEach(([name, conf]) => {
        if (conf.id) {
          this.terrainIdMap[conf.id] = { ...conf, name }
          this.terrainNameMap[name] = conf.id
        }
      })
    }

    // Tags
    if (this.TAGS_CONFIG) {
      Object.entries(this.TAGS_CONFIG).forEach(([name, conf]) => {
        if (conf.id) {
          this.tagIdMap[conf.id] = { ...conf, name }
          this.tagNameMap[name] = conf.id
        }
      })
    }
  }

  loadTextures(): void {
    let total = 0
    if (this.TERRAIN_CONFIG) {
      Object.values(this.TERRAIN_CONFIG).forEach((c) => { if (c.texture) total++ })
    }
    if (this.TAGS_CONFIG) {
      Object.values(this.TAGS_CONFIG).forEach((c) => { if (c.texture) total++ })
    }

    if (total === 0) {
      this.requestDraw()
      return
    }

    const onImageLoad = (): void => {
      this.imagesLoaded++
      if (this.imagesLoaded >= total) this.requestDraw()
    }

    // Load Terrains
    if (this.TERRAIN_CONFIG) {
      Object.keys(this.TERRAIN_CONFIG).forEach((key) => {
        const conf = this.TERRAIN_CONFIG[key]
        if (!conf || !conf.texture) return
        const img = new Image()
        img.src = conf.texture.startsWith('http') ? conf.texture : `textures/${conf.texture}`
        img.onload = () => {
          if (conf.id) {
            this.loadedPatterns[conf.id] = this.ctx.createPattern(img, 'repeat')
            this.terrainImages[conf.id] = img
          }
          onImageLoad()
        }
        img.onerror = () => {
          console.warn(`Failed: textures/${conf.texture}`)
          onImageLoad()
        }
      })
    }

    // Load Tags
    this.tagImages = {}
    if (this.TAGS_CONFIG) {
      Object.keys(this.TAGS_CONFIG).forEach((key) => {
        const conf = this.TAGS_CONFIG[key]
        if (!conf || !conf.texture) return
        const img = new Image()
        img.src = conf.texture.startsWith('http') ? conf.texture : `tags_images/${conf.texture}`
        img.onload = () => {
          if (conf.id) this.tagImages[conf.id] = img
          onImageLoad()
        }
        img.onerror = () => {
          console.warn(`Failed: ${conf.texture}`)
          onImageLoad()
        }
      })
    }
  }

  resizeCanvas(): void {
    if (!this.container || !this.canvas) return
    this.dpr = window.devicePixelRatio || 1
    const rect = this.container.getBoundingClientRect()
    this.canvas.width = rect.width * this.dpr
    this.canvas.height = rect.height * this.dpr
    this.canvas.style.width = `${rect.width}px`
    this.canvas.style.height = `${rect.height}px`
    this.requestDraw()
  }

  // --- HELPER: Resolve ID from potentially legacy data ---
  resolveTerrainId(val: number | string | undefined): number {
    if (typeof val === 'number') return val
    if (typeof val === 'string' && this.terrainNameMap[val]) return this.terrainNameMap[val]
    return 1 // Default Water
  }

  resolveTagId(val: number | string | null | undefined): number | null {
    if (!val) return null
    if (typeof val === 'number') return val
    if (typeof val === 'string' && this.tagNameMap[val]) return this.tagNameMap[val]
    return null
  }

  // Math methods
  getHexCenter(col: number, row: number): { x: number; y: number } {
    const size = this.CONFIG.hexSize
    const c = col - 1
    const r = row - 1
    const x = c * 1.5 * size + size * 2
    const yOffset = (c % 2) * ((Math.sqrt(3) * size) / 2)
    const y = r * Math.sqrt(3) * size + yOffset + size * 2
    return { x, y }
  }

  randomOffset(col: number, row: number): { x: number; y: number } {
    const seed = col * 4923 + row * 1932
    return { x: (Math.sin(seed) * 1000) % 200, y: (Math.cos(seed) * 1000) % 200 }
  }

  toWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (screenX - rect.left - this.camera.x) / this.camera.zoom,
      y: (screenY - rect.top - this.camera.y) / this.camera.zoom,
    }
  }

  getHexAt(worldX: number, worldY: number): HexCoord | null {
    let closestHex: HexCoord | null = null
    let minDistance = Infinity
    for (let col = 1; col <= this.CONFIG.gridW; col++) {
      for (let row = 1; row <= this.CONFIG.gridH; row++) {
        const center = this.getHexCenter(col, row)
        const dist = Math.sqrt((worldX - center.x) ** 2 + (worldY - center.y) ** 2)
        if (dist <= this.CONFIG.hexSize * 1.1) {
          if (dist < minDistance) {
            minDistance = dist
            closestHex = { x: col, y: row }
          }
        }
      }
    }
    return closestHex
  }

  getNeighbor(col: number, row: number, direction: number): { c: number; r: number } {
    const isOddCol = col % 2 !== 0
    const offsets = isOddCol
      ? [{ c: 1, r: 0 }, { c: 0, r: 1 }, { c: -1, r: 0 }, { c: -1, r: -1 }, { c: 0, r: -1 }, { c: 1, r: -1 }]
      : [{ c: 1, r: 1 }, { c: 0, r: 1 }, { c: -1, r: 1 }, { c: -1, r: 0 }, { c: 0, r: -1 }, { c: 1, r: 0 }]
    const o = offsets[direction]!
    return { c: col + o.c, r: row + o.r }
  }

  fitToView(): void {
    const rect = this.container.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    // Calculate zoom to fit the entire grid, but position at top-left
    const bottomRight = this.getHexCenter(this.CONFIG.gridW, this.CONFIG.gridH)
    const size = this.CONFIG.hexSize

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
    // Align to top-left instead of centering
    this.camera.x = margin - mapLeft * zoom
    this.camera.y = margin - mapTop * zoom

    this.requestDraw()
  }

  focusOnHex(x: number, y: number): void {
    if (x < 1 || x > this.CONFIG.gridW || y < 1 || y > this.CONFIG.gridH) return
    const center = this.getHexCenter(x, y)
    const zoomLevel = 2.0
    const rect = this.canvas.getBoundingClientRect()
    this.camera.zoom = zoomLevel
    this.camera.x = rect.width / 2 - center.x * zoomLevel
    this.camera.y = rect.height / 2 - center.y * zoomLevel
    this.requestDraw()
  }

  draw(hexData: Record<string, HexData>, selectedHex: HexCoord | null, isPaintMode: boolean, userRole: string = 'Player', markers?: Record<string, HexMarkerData>): void {
    if (!Number.isFinite(this.camera.x)) this.camera = { x: 50, y: 50, zoom: 1 }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.scale(this.dpr, this.dpr)
    this.ctx.translate(this.camera.x, this.camera.y)
    this.ctx.scale(this.camera.zoom, this.camera.zoom)

    const isWater = (id: number): boolean => {
      const conf = this.terrainIdMap[id]
      return conf != null && (conf.name === 'Water' || conf.name === 'Deep Water')
    }

    for (let col = 1; col <= this.CONFIG.gridW; col++) {
      for (let row = 1; row <= this.CONFIG.gridH; row++) {
        const center = this.getHexCenter(col, row)
        const key = `${col}_${row}`
        const data: HexData = hexData[key] || {}

        // RESOLVE TYPE ID (Legacy support)
        const typeId = this.resolveTerrainId(data.type)

        let mainTagId: number | null = null
        // RESOLVE TAG ID (Legacy support)
        if (data.mainTag) {
          mainTagId = this.resolveTagId(data.mainTag)
        }

        if (userRole === 'player' && data.mainTagIsPrivate) mainTagId = null

        const sideTags = (data.tags || []).map((t) => this.resolveTagId(t)).filter((t): t is number => t !== null)

        const shoreEdges: boolean[] = []
        if (isWater(typeId)) {
          for (let i = 0; i < 6; i++) {
            const n = this.getNeighbor(col, row, i)
            const nKey = `${n.c}_${n.r}`
            const nData = hexData[nKey]
            const nType = nData ? this.resolveTerrainId(nData.type) : 1

            if (nData && !isWater(nType)) {
              shoreEdges[i] = true
            } else {
              shoreEdges[i] = false
            }
          }
        }

        this.drawSingleHex(col, row, center, typeId, mainTagId, sideTags, shoreEdges)
      }
    }

    this.drawLabels(selectedHex)
    if (markers) this.drawHexIndicators(markers, userRole)
    if (!isPaintMode && selectedHex) this.drawSelectionHighlight(selectedHex)
  }

  drawSingleHex(
    col: number,
    row: number,
    center: { x: number; y: number },
    typeId: number,
    mainTagId: number | null,
    sideTags: number[],
    shoreEdges: boolean[] = []
  ): void {
    // Fallback to Water if invalid ID
    const config = this.terrainIdMap[typeId] || this.terrainIdMap[1]

    // Safety: If config still missing, skip
    if (!config) return

    const size = this.CONFIG.hexSize

    this.ctx.beginPath()
    const angle = (2 * Math.PI) / 6
    const drawSize = size * 1.02
    for (let i = 0; i < 6; i++) {
      this.ctx.lineTo(center.x + drawSize * Math.cos(angle * i), center.y + drawSize * Math.sin(angle * i))
    }
    this.ctx.closePath()

    const terrainImg = this.terrainImages[typeId]
    if (terrainImg) {
      // Clip to hex shape and draw full image fitted inside
      this.ctx.save()
      this.ctx.clip()
      const imgSize = size * 2.1
      this.ctx.drawImage(terrainImg, center.x - imgSize / 2, center.y - imgSize / 2, imgSize, imgSize)
      this.ctx.restore()
      // Re-draw hex path for the stroke (clip consumed it)
      this.ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        this.ctx.lineTo(center.x + drawSize * Math.cos(angle * i), center.y + drawSize * Math.sin(angle * i))
      }
      this.ctx.closePath()
    } else {
      this.ctx.fillStyle = config.color || '#789'
      this.ctx.fill()
    }

    this.ctx.strokeStyle = 'rgba(0,0,0,0.2)'
    this.ctx.lineWidth = 1
    this.ctx.stroke()

    if (shoreEdges.some((e) => e)) {
      const surfRadius = size * 1
      this.defineShorePath({ x: col, y: row }, center, angle, shoreEdges, surfRadius)
      this.ctx.save()
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      this.ctx.lineWidth = size / 5
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.9)'
      this.ctx.shadowBlur = size / 3
      this.ctx.stroke()
      this.ctx.restore()
      this.ctx.save()
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      this.ctx.lineWidth = size / 12
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
      this.ctx.shadowBlur = size / 10
      this.ctx.stroke()
      this.ctx.restore()
    }

    if (mainTagId) {
      const img = this.tagImages[mainTagId]
      if (img) {
        const imgSize = size * 0.9
        this.ctx.drawImage(img, center.x - imgSize / 2, center.y - imgSize / 2, imgSize, imgSize)
      }
    }

    if (sideTags && sideTags.length > 0) {
      sideTags.slice(0, 6).forEach((tagId, index) => {
        const img = this.tagImages[tagId]
        if (!img) return
        const cornerAngle = angle * index
        const dist = size * 0.7
        const markerSize = size * 0.4
        const cx = center.x + dist * Math.cos(cornerAngle)
        const cy = center.y + dist * Math.sin(cornerAngle)
        this.ctx.drawImage(img, cx - markerSize / 2, cy - markerSize / 2, markerSize, markerSize)
      })
    }
  }

  drawLabels(selectedHex: HexCoord | null): void {
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    const size = this.CONFIG.hexSize

    for (let col = 1; col <= this.CONFIG.gridW; col++) {
      const center = this.getHexCenter(col, 0)
      const x = center.x
      const y = size - 15
      this.ctx.fillStyle = selectedHex && selectedHex.x === col ? '#f39c12' : '#888'
      this.ctx.font = selectedHex && selectedHex.x === col ? 'bold 16px Arial' : '14px Arial'
      this.ctx.fillText(String(col), x, y)
    }
    for (let row = 1; row <= this.CONFIG.gridH; row++) {
      const center = this.getHexCenter(1, row)
      this.ctx.fillStyle = selectedHex && selectedHex.y === row ? '#f39c12' : '#888'
      this.ctx.font = selectedHex && selectedHex.y === row ? 'bold 16px Arial' : '14px Arial'
      this.ctx.fillText(String(row), -10, center.y)
    }
  }

  drawSelectionHighlight(hex: HexCoord): void {
    const center = this.getHexCenter(hex.x, hex.y)
    const size = this.CONFIG.hexSize
    const angle = (2 * Math.PI) / 6

    this.ctx.save()
    this.ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      this.ctx.lineTo(
        center.x + size * Math.cos(angle * i),
        center.y + size * Math.sin(angle * i)
      )
    }
    this.ctx.closePath()

    this.ctx.shadowColor = '#f39c12'
    this.ctx.shadowBlur = 15
    this.ctx.strokeStyle = '#f39c12'
    this.ctx.lineWidth = 4
    this.ctx.stroke()
    this.ctx.restore()
  }

  /**
   * Collect all drawable icons for a hex into a flat list.
   * Priority: location > feature > markers > notes
   */
  private collectHexIcons(data: HexMarkerData): { img: HTMLImageElement | null; emoji?: string }[] {
    const icons: { img: HTMLImageElement | null; emoji?: string }[] = []

    // Location icon
    if (data.locationType) {
      const img = this.iconImages[data.locationType] || this.iconImages['other'] || null
      icons.push({ img })
    }

    // Feature icon (always show if features exist, even alongside a location)
    if (data.featureCount > 0) {
      const img = this.iconImages['feature'] || null
      icons.push({ img })
    }

    // Marker type icons (each unique type gets an icon)
    if (data.markerTypes) {
      for (const mt of data.markerTypes) {
        const img = this.iconImages[mt] || null
        icons.push({ img })
      }
    }

    // Note indicator
    if (data.noteCount > 0) {
      icons.push({ img: null, emoji: '💬' })
    }

    return icons
  }

  /**
   * Get positions for N icons inside a hex, centered.
   * 1 icon: center. 2-3: horizontal row. 4-6: two rows. 7: honeycomb.
   */
  private getIconPositions(cx: number, cy: number, count: number, iconSize: number): { x: number; y: number }[] {
    const gap = iconSize * 0.15
    const step = iconSize + gap

    if (count === 1) return [{ x: cx, y: cy }]

    if (count <= 3) {
      // Single horizontal row, centered
      const totalW = (count - 1) * step
      return Array.from({ length: count }, (_, i) => ({
        x: cx - totalW / 2 + i * step,
        y: cy
      }))
    }

    if (count <= 6) {
      // Two rows
      const topCount = Math.ceil(count / 2)
      const botCount = count - topCount
      const rowOffset = step * 0.45
      const positions: { x: number; y: number }[] = []

      const topW = (topCount - 1) * step
      for (let i = 0; i < topCount; i++) {
        positions.push({ x: cx - topW / 2 + i * step, y: cy - rowOffset })
      }
      const botW = (botCount - 1) * step
      for (let i = 0; i < botCount; i++) {
        positions.push({ x: cx - botW / 2 + i * step, y: cy + rowOffset })
      }
      return positions
    }

    // 7: honeycomb — 3 top, 1 center, 3 bottom (or 2-3-2)
    const rowOffset = step * 0.5
    const positions: { x: number; y: number }[] = []
    // Top row: 2
    for (let i = 0; i < 2; i++) positions.push({ x: cx - step * 0.5 + i * step, y: cy - rowOffset })
    // Middle row: 3
    for (let i = 0; i < 3; i++) positions.push({ x: cx - step + i * step, y: cy })
    // Bottom row: 2
    for (let i = 0; i < 2; i++) positions.push({ x: cx - step * 0.5 + i * step, y: cy + rowOffset })
    return positions
  }

  drawHexIndicators(markers: Record<string, HexMarkerData>, userRole: string = 'player'): void {
    const size = this.CONFIG.hexSize
    const isDmOrAdmin = userRole === 'dm' || userRole === 'admin'
    const zoom = this.camera.zoom

    // Determine how many icons to show based on zoom level
    let maxIcons: number
    if (zoom >= 3.0) maxIcons = 7       // super close
    else if (zoom >= 1.5) maxIcons = 6  // pretty close
    else if (zoom >= 0.6) maxIcons = 3  // medium
    else maxIcons = 1                   // far out

    // Icon size: when single icon, fill most of the hex.
    // At low zoom, icon should be ~100% of hex; at high zoom, ~80%
    const singleIconFill = zoom < 1.0 ? 1.0 : 0.8
    // For multiple icons, scale down to fit
    const multiIconScale = zoom < 1.0 ? 0.55 : 0.45

    for (const [hexKey, data] of Object.entries(markers)) {
      const parts = hexKey.split('_')
      const col = parseInt(parts[0]!)
      const row = parseInt(parts[1]!)
      if (isNaN(col) || isNaN(row)) continue
      if (col < 1 || col > this.CONFIG.gridW || row < 1 || row > this.CONFIG.gridH) continue

      // For players, skip entirely hidden markers
      if (data.hidden && !isDmOrAdmin) continue

      const center = this.getHexCenter(col, row)
      const isHidden = data.hasHiddenItems || data.hidden

      // Collect all icons for this hex
      const allIcons = this.collectHexIcons(data)
      if (allIcons.length === 0) continue

      const showCount = Math.min(allIcons.length, maxIcons)
      const iconsToShow = allIcons.slice(0, showCount)

      // Determine icon draw size
      const iconDrawSize = iconsToShow.length === 1
        ? size * 2 * singleIconFill   // single icon: fill hex diameter
        : size * 2 * multiIconScale   // multiple: smaller

      const positions = this.getIconPositions(center.x, center.y, iconsToShow.length, iconDrawSize)

      for (let i = 0; i < iconsToShow.length; i++) {
        const icon = iconsToShow[i]!
        const pos = positions[i]!
        const drawSize = iconDrawSize

        this.ctx.save()
        if (isHidden && isDmOrAdmin) this.ctx.globalAlpha = 0.3
        this.ctx.shadowColor = 'rgba(0,0,0,0.6)'
        this.ctx.shadowBlur = 3

        if (icon.img) {
          this.ctx.drawImage(icon.img, pos.x - drawSize / 2, pos.y - drawSize / 2, drawSize, drawSize)
        } else if (icon.emoji) {
          this.ctx.font = `${drawSize * 0.7}px sans-serif`
          this.ctx.textAlign = 'center'
          this.ctx.textBaseline = 'middle'
          this.ctx.fillText(icon.emoji, pos.x, pos.y)
        } else {
          // Fallback dot for icons whose image hasn't loaded
          const r = drawSize * 0.3
          this.ctx.beginPath()
          this.ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
          this.ctx.fillStyle = '#ef233c'
          this.ctx.fill()
          this.ctx.strokeStyle = 'rgba(0,0,0,0.4)'
          this.ctx.lineWidth = 1.5
          this.ctx.stroke()
        }

        this.ctx.restore()
      }
    }
  }

  getSeededRandom(x: number, y: number, edgeIndex: number, stepIndex: number, axis: number): number {
    const seed = x * 374761393 + y * 668265263 + edgeIndex * 19283 + stepIndex * 5347 + axis * 29384
    const val = Math.sin(seed) * 10000
    return val - Math.floor(val)
  }

  defineShorePath(
    hex: HexCoord,
    center: { x: number; y: number },
    angle: number,
    shoreEdges: boolean[],
    radius: number
  ): void {
    const subdivisions = 6
    const jitterMax = this.CONFIG.hexSize / 20
    this.ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      if (shoreEdges[i]) {
        const startAngle = angle * i
        const endAngle = angle * (i + 1)
        const start = {
          x: center.x + radius * Math.cos(startAngle),
          y: center.y + radius * Math.sin(startAngle),
        }
        const end = {
          x: center.x + radius * Math.cos(endAngle),
          y: center.y + radius * Math.sin(endAngle),
        }
        this.ctx.moveTo(start.x, start.y)
        for (let j = 1; j <= subdivisions; j++) {
          const t = j / subdivisions
          let lx = start.x + (end.x - start.x) * t
          let ly = start.y + (end.y - start.y) * t
          if (j < subdivisions) {
            const randX = this.getSeededRandom(hex.x, hex.y, i, j, 0)
            const randY = this.getSeededRandom(hex.x, hex.y, i, j, 1)
            lx += (randX - 0.5) * jitterMax
            ly += (randY - 0.5) * jitterMax
          }
          this.ctx.lineTo(lx, ly)
        }
      }
    }
  }

  requestDraw(): void {
    if (this.onCameraChange) this.onCameraChange()
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isPanning || this.isLeftMouseDown) {
      const dx = e.clientX - this.lastMouse.x
      const dy = e.clientY - this.lastMouse.y
      // Track drag distance for left-click
      if (this.isLeftMouseDown && !this.hasDragged) {
        const totalDx = e.clientX - this.leftDownStart.x
        const totalDy = e.clientY - this.leftDownStart.y
        if (Math.hypot(totalDx, totalDy) > 5) {
          this.hasDragged = true
        }
      }
      // Pan with any held button (left, middle, right)
      this.camera.x += dx
      this.camera.y += dy
      this.container.style.cursor = 'grabbing'
      if (this.onCameraChange) this.onCameraChange()
    }
    this.lastMouse = { x: e.clientX, y: e.clientY }
  }

  private handleMouseUp(): void {
    this.isPanning = false
    this.isLeftMouseDown = false
    this.container.style.cursor = 'default'
  }

  setupInputListeners(): void {
    this.container.addEventListener('contextmenu', (e) => e.preventDefault())

    this.container.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1 || e.button === 2) {
        this.isPanning = true
        this.container.style.cursor = 'grabbing'
        e.preventDefault()
      } else if (e.button === 0) {
        this.isPanning = false
        this.isLeftMouseDown = true
        this.hasDragged = false
        this.leftDownStart = { x: e.clientX, y: e.clientY }
      }
      this.lastMouse = { x: e.clientX, y: e.clientY }
    })

    window.addEventListener('mousemove', this._boundMouseMove)
    window.addEventListener('mouseup', this._boundMouseUp)

    this.canvas.addEventListener('click', (e: MouseEvent) => {
      if (e.button !== 0 || this.hasDragged) return
      const worldPos = this.toWorld(e.clientX, e.clientY)
      const hex = this.getHexAt(worldPos.x, worldPos.y)
      if (hex && this.onHexClick) this.onHexClick(hex, e.clientX, e.clientY, 'click')
    })

    this.container.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault()
        const zoomSensitivity = 0.001
        const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity)
        const rect = this.canvas.getBoundingClientRect()
        const newZoom = Math.min(Math.max(this.camera.zoom * zoomFactor, 0.2), 5.0)
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const worldX = (mouseX - this.camera.x) / this.camera.zoom
        const worldY = (mouseY - this.camera.y) / this.camera.zoom
        this.camera.x = mouseX - worldX * newZoom
        this.camera.y = mouseY - worldY * newZoom
        this.camera.zoom = newZoom
        if (this.onCameraChange) this.onCameraChange()
      },
      { passive: false }
    )

    // Touch events
    this.container.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length === 1) {
          const touch = e.touches[0]!
          this.isPanning = true
          this.hasMoved = false
          this.touchStartX = touch.clientX
          this.touchStartY = touch.clientY
          this.lastMouse = { x: touch.clientX, y: touch.clientY }
        } else if (e.touches.length === 2) {
          this.isPanning = false
          this.hasMoved = true
          const t1 = e.touches[0]!
          const t2 = e.touches[1]!
          const dx = t1.clientX - t2.clientX
          const dy = t1.clientY - t2.clientY
          this.initialPinchDist = Math.hypot(dx, dy) || 1
          this.initialCamZoom = this.camera.zoom
          this.initialCamX = this.camera.x
          this.initialCamY = this.camera.y
          const rect = this.canvas.getBoundingClientRect()
          const screenCX = (t1.clientX + t2.clientX) / 2 - rect.left
          const screenCY = (t1.clientY + t2.clientY) / 2 - rect.top
          this.initialWorldX = (screenCX - this.initialCamX) / this.initialCamZoom
          this.initialWorldY = (screenCY - this.initialCamY) / this.initialCamZoom
        }
      },
      { passive: false }
    )

    this.container.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        e.preventDefault()
        if (e.touches.length === 1) {
          const touch = e.touches[0]!
          const moveDist = Math.hypot(
            touch.clientX - this.touchStartX,
            touch.clientY - this.touchStartY
          )
          if (moveDist > 10) this.hasMoved = true
        }
        if (e.touches.length === 1 && this.isPanning) {
          const touch = e.touches[0]!
          const currentX = touch.clientX
          const currentY = touch.clientY
          const rawDx = currentX - this.lastMouse.x
          const rawDy = currentY - this.lastMouse.y
          let speedFactor = 1.0
          if (this.camera.zoom > 1.0) speedFactor = 1.0 + (this.camera.zoom - 1.0) * 0.8
          this.camera.x += rawDx * speedFactor
          this.camera.y += rawDy * speedFactor
          this.lastMouse = { x: currentX, y: currentY }
          if (this.onCameraChange) this.onCameraChange()
        } else if (e.touches.length === 2 && this.initialPinchDist) {
          const t1 = e.touches[0]!
          const t2 = e.touches[1]!
          const dx = t1.clientX - t2.clientX
          const dy = t1.clientY - t2.clientY
          const dist = Math.hypot(dx, dy)
          const scale = dist / this.initialPinchDist
          if (!Number.isFinite(scale)) return
          const newZoom = Math.min(Math.max(this.initialCamZoom * scale, 0.2), 5.0)
          const rect = this.canvas.getBoundingClientRect()
          const currentScreenCX = (t1.clientX + t2.clientX) / 2 - rect.left
          const currentScreenCY = (t1.clientY + t2.clientY) / 2 - rect.top
          this.camera.zoom = newZoom
          this.camera.x = currentScreenCX - this.initialWorldX * newZoom
          this.camera.y = currentScreenCY - this.initialWorldY * newZoom
          if (this.onCameraChange) this.onCameraChange()
        }
      },
      { passive: false }
    )

    this.container.addEventListener('touchend', (e: TouchEvent) => {
      if (!this.hasMoved && e.changedTouches.length > 0) {
        const t = e.changedTouches[0]!
        const worldPos = this.toWorld(t.clientX, t.clientY)
        const hex = this.getHexAt(worldPos.x, worldPos.y)
        if (this.onHexClick) {
          this.onHexClick(hex, t.clientX, t.clientY, 'down')
          this.onHexClick(hex, t.clientX, t.clientY, 'click')
        }
      }
      this.isPanning = false
      this.initialPinchDist = null
    })
  }
}

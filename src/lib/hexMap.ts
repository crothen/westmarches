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

export type MapPathType = 'road-solid' | 'road-dotted' | 'river'

export interface MapPath {
  id: string
  type: MapPathType
  /** Waypoints in world coordinates (hex map space, not screen) */
  points: { x: number; y: number }[]
  createdBy?: string
  createdAt?: Date
}

export interface HexIconEntry {
  kind: 'location' | 'feature' | 'marker' | 'note'
  type: string        // location type, feature type, marker type, or 'note'
  order?: number      // display priority (lower = show first)
  hidden?: boolean
}

export interface HexMarkerData {
  icons: HexIconEntry[]
  hidden?: boolean  // true if ALL items in this hex are hidden
  hasHiddenItems?: boolean  // true if ANY item in this hex is hidden
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

  /** When true, left-click drag does NOT pan — used for draw mode */
  disableLeftDragPan: boolean

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
    this.disableLeftDragPan = false

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
   * Accepts optional markerTypesConfig from Firestore with Storage URLs.
   */
  loadIconImages(markerTypesConfig?: {
    locationTypes?: Record<string, { iconUrl: string }>
    featureTypes?: Record<string, { iconUrl: string }>
    hexMarkerTypes?: Record<string, { iconUrl: string }>
  }): void {
    const iconPaths: Record<string, string> = {}

    if (markerTypesConfig) {
      // Use Firestore config (Storage URLs)
      for (const [key, entry] of Object.entries(markerTypesConfig.locationTypes || {})) {
        if (entry.iconUrl) iconPaths[key] = entry.iconUrl
      }
      for (const [key, entry] of Object.entries(markerTypesConfig.featureTypes || {})) {
        if (entry.iconUrl) iconPaths[`f:${key}`] = entry.iconUrl
      }
      // Also keep un-prefixed feature key as fallback
      if (markerTypesConfig.featureTypes?.['other']?.iconUrl) {
        iconPaths['feature'] = markerTypesConfig.featureTypes['other'].iconUrl
      }
      for (const [key, entry] of Object.entries(markerTypesConfig.hexMarkerTypes || {})) {
        if (entry.iconUrl) iconPaths[key] = entry.iconUrl
      }
    } else {
      // Fallback to hardcoded local paths
      Object.assign(iconPaths, {
        city: '/icons/locations/city.png', town: '/icons/locations/town.png',
        village: '/icons/locations/village.png', castle: '/icons/locations/castle.png',
        fortress: '/icons/locations/fortress.png', monastery: '/icons/locations/monastery.png',
        camp: '/icons/locations/camp.png', ruins: '/icons/locations/ruins.png',
        other: '/icons/locations/other.png',
        clue: '/icons/markers/clue.png', battle: '/icons/markers/battle.png',
        danger: '/icons/markers/danger.png', puzzle: '/icons/markers/puzzle.png',
        mystery: '/icons/markers/mystery.png', waypoint: '/icons/markers/waypoint.png',
        quest: '/icons/markers/quest.png', locked: '/icons/markers/locked.png',
        unlocked: '/icons/markers/unlocked.png',
        feature: '/icons/features/other.png',
      })
    }

    for (const [key, path] of Object.entries(iconPaths)) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
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

  draw(hexData: Record<string, HexData>, selectedHex: HexCoord | null, isPaintMode: boolean, userRole: string = 'Player', markers?: Record<string, HexMarkerData>, paths?: MapPath[], drawingPreview?: { type: MapPathType; points: { x: number; y: number }[]; cursor?: { x: number; y: number } }): void {
    if (!Number.isFinite(this.camera.x)) this.camera = { x: 50, y: 50, zoom: 1 }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.scale(this.dpr, this.dpr)
    this.ctx.translate(this.camera.x, this.camera.y)
    this.ctx.scale(this.camera.zoom, this.camera.zoom)

    // === PASS 1: Draw all hex terrain fills (no borders) ===
    for (let col = 1; col <= this.CONFIG.gridW; col++) {
      for (let row = 1; row <= this.CONFIG.gridH; row++) {
        const center = this.getHexCenter(col, row)
        const key = `${col}_${row}`
        const data: HexData = hexData[key] || {}

        const typeId = this.resolveTerrainId(data.type)

        let mainTagId: number | null = null
        if (data.mainTag) {
          mainTagId = this.resolveTagId(data.mainTag)
        }
        if (userRole === 'player' && data.mainTagIsPrivate) mainTagId = null

        const sideTags = (data.tags || []).map((t) => this.resolveTagId(t)).filter((t): t is number => t !== null)

        // Draw fill only (border drawn in pass 3)
        this.drawSingleHexFill(col, row, center, typeId, mainTagId, sideTags)
      }
    }

    // === PASS 2: Draw noise-based terrain blending ===
    this.drawTerrainBlending(hexData)

    // === PASS 2.5: Draw map paths (roads/rivers) ===
    if (paths && paths.length > 0) this.drawPaths(paths)
    if (drawingPreview) this.drawPathPreview(drawingPreview)

    // === PASS 3: Draw all hex borders ===
    this.drawHexBorders()

    this.drawLabels(selectedHex)
    if (markers) this.drawHexIndicators(markers, userRole)
    if (!isPaintMode && selectedHex) this.drawSelectionHighlight(selectedHex)
  }

  drawSingleHexFill(
    _col: number,
    _row: number,
    center: { x: number; y: number },
    typeId: number,
    mainTagId: number | null,
    sideTags: number[]
  ): void {
    const config = this.terrainIdMap[typeId] || this.terrainIdMap[1]
    if (!config) return

    const size = this.CONFIG.hexSize
    const angle = (2 * Math.PI) / 6
    const drawSize = size * 1.02

    // Draw hex fill
    this.ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      this.ctx.lineTo(center.x + drawSize * Math.cos(angle * i), center.y + drawSize * Math.sin(angle * i))
    }
    this.ctx.closePath()

    const terrainImg = this.terrainImages[typeId]
    if (terrainImg) {
      this.ctx.save()
      this.ctx.clip()
      const imgSize = size * 2.1
      this.ctx.drawImage(terrainImg, center.x - imgSize / 2, center.y - imgSize / 2, imgSize, imgSize)
      this.ctx.restore()
    } else {
      this.ctx.fillStyle = config.color || '#789'
      this.ctx.fill()
    }

    // Shore effects removed — terrain blending handles transitions

    // Tags
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

  /**
   * Draw hex borders as a separate pass (on top of blending).
   */
  drawHexBorders(): void {
    const size = this.CONFIG.hexSize
    const angle = (2 * Math.PI) / 6
    const drawSize = size * 1.02

    // Dark semi-transparent border that reads over any terrain texture
    this.ctx.strokeStyle = 'rgba(30, 30, 30, 0.25)'
    this.ctx.lineWidth = 1.5

    for (let col = 1; col <= this.CONFIG.gridW; col++) {
      for (let row = 1; row <= this.CONFIG.gridH; row++) {
        const center = this.getHexCenter(col, row)
        this.ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          this.ctx.lineTo(
            center.x + drawSize * Math.cos(angle * i),
            center.y + drawSize * Math.sin(angle * i)
          )
        }
        this.ctx.closePath()
        this.ctx.stroke()
      }
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
   * Collect all drawable icons for a hex, sorted by order.
   */
  private collectHexIcons(data: HexMarkerData): { img: HTMLImageElement | null; emoji?: string }[] {
    // Sort by order (lower first), then by kind priority
    const kindPriority: Record<string, number> = { location: 0, feature: 1, marker: 2, note: 3 }
    const sorted = [...data.icons].sort((a, b) => {
      const oa = a.order ?? 999
      const ob = b.order ?? 999
      if (oa !== ob) return oa - ob
      return (kindPriority[a.kind] ?? 9) - (kindPriority[b.kind] ?? 9)
    })

    return sorted.map(entry => {
      if (entry.kind === 'note') {
        return { img: null, emoji: '💬' }
      }
      if (entry.kind === 'location') {
        return { img: this.iconImages[entry.type] || this.iconImages['other'] || null }
      }
      if (entry.kind === 'feature') {
        return { img: this.iconImages[`f:${entry.type}`] || this.iconImages['feature'] || this.iconImages['other'] || null }
      }
      // marker
      return { img: this.iconImages[entry.type] || null }
    })
  }

  /**
   * Get positions for N icons inside a hex.
   * Layout tiers based on count:
   *  1: center
   *  2-3: alternating corners (top, bottom-left, bottom-right)
   *  4-6: all 6 corners
   *  7: all 6 corners + center
   */
  private getIconPositions(cx: number, cy: number, count: number, hexSize: number): { x: number; y: number }[] {
    const dist = hexSize * 0.55 // distance from center to icon position (inside hex)
    const angle = (2 * Math.PI) / 6

    // 6 corner positions (starting from top, going clockwise)
    const allCorners: { x: number; y: number }[] = []
    for (let i = 0; i < 6; i++) {
      const a = angle * i - Math.PI / 2 // start from top
      allCorners.push({ x: cx + dist * Math.cos(a), y: cy + dist * Math.sin(a) })
    }
    // Alternating corners: top(0), bottom-right(2), bottom-left(4)
    const altCorners = [allCorners[0]!, allCorners[2]!, allCorners[4]!]

    if (count === 1) return [{ x: cx, y: cy }]

    if (count <= 3) {
      return altCorners.slice(0, count)
    }

    if (count <= 6) {
      return allCorners.slice(0, count)
    }

    // 7: center + all 6 corners
    return [{ x: cx, y: cy }, ...allCorners]
  }

  drawHexIndicators(markers: Record<string, HexMarkerData>, userRole: string = 'player'): void {
    const size = this.CONFIG.hexSize
    const isDmOrAdmin = userRole === 'dm' || userRole === 'admin'
    const zoom = this.camera.zoom

    // Determine how many icons to show based on zoom level
    let maxIcons: number
    if (zoom >= 5.0) maxIcons = 7       // full zoom: corners + center
    else if (zoom >= 3.0) maxIcons = 6  // close: all corners
    else if (zoom >= 1.5) maxIcons = 3  // medium: alternating corners
    else maxIcons = 1                   // far out: center only

    // Icon size relative to hex
    const singleIconFill = zoom < 1.0 ? 1.0 : 0.8

    for (const [hexKey, data] of Object.entries(markers)) {
      const parts = hexKey.split('_')
      const col = parseInt(parts[0]!)
      const row = parseInt(parts[1]!)
      if (isNaN(col) || isNaN(row)) continue
      if (col < 1 || col > this.CONFIG.gridW || row < 1 || row > this.CONFIG.gridH) continue

      // Filter out hidden icons for non-DM/admin
      const visibleIcons = isDmOrAdmin ? data.icons : data.icons.filter(i => !i.hidden)
      if (visibleIcons.length === 0) continue

      const center = this.getHexCenter(col, row)
      const isHidden = data.hasHiddenItems

      // Collect drawable icons for this hex
      const filteredData: HexMarkerData = { ...data, icons: visibleIcons }
      const allIcons = this.collectHexIcons(filteredData)
      if (allIcons.length === 0) continue

      const showCount = Math.min(allIcons.length, maxIcons)
      const iconsToShow = allIcons.slice(0, showCount)

      // Determine icon draw size — smaller for more icons
      let iconDrawSize: number
      if (iconsToShow.length === 1) {
        iconDrawSize = size * 2 * singleIconFill
      } else if (iconsToShow.length <= 3) {
        iconDrawSize = size * 0.7
      } else {
        iconDrawSize = size * 0.5  // smaller for 4-7 to avoid overlap
      }

      const positions = this.getIconPositions(center.x, center.y, iconsToShow.length, size)

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

  /**
   * Simple 2D seeded noise for terrain blending.
   * Returns a value between 0 and 1 that is deterministic for the same inputs.
   */
  private blendNoise(wx: number, wy: number, scale: number = 0.05): number {
    const sx = wx * scale
    const sy = wy * scale
    const ix = Math.floor(sx)
    const iy = Math.floor(sy)
    const fx = sx - ix
    const fy = sy - iy

    // Smooth interpolation
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)

    const hash = (a: number, b: number): number => {
      const h = a * 374761393 + b * 668265263
      const v = Math.sin(h) * 43758.5453
      return v - Math.floor(v)
    }

    const n00 = hash(ix, iy)
    const n10 = hash(ix + 1, iy)
    const n01 = hash(ix, iy + 1)
    const n11 = hash(ix + 1, iy + 1)

    const nx0 = n00 + (n10 - n00) * ux
    const nx1 = n01 + (n11 - n01) * ux
    return nx0 + (nx1 - nx0) * uy
  }

  /**
   * Draw noise-based terrain blending along edges where adjacent hexes have different terrain.
   * For each shared edge, one terrain's texture extends ~30% past the border into the neighbor.
   * Noise carves the boundary shape — no blobs, just a continuous wiggly edge.
   */
  drawTerrainBlending(hexData: Record<string, HexData>): void {
    const size = this.CONFIG.hexSize
    const angle = (2 * Math.PI) / 6
    const drawSize = size * 1.02
    const maxSpill = size * 0.4     // how far texture can extend past border
    const curvePoints = 24          // resolution of the noise boundary curve

    const processedEdges = new Set<string>()

    for (let col = 1; col <= this.CONFIG.gridW; col++) {
      for (let row = 1; row <= this.CONFIG.gridH; row++) {
        const key = `${col}_${row}`
        const data = hexData[key] || {}
        const typeId = this.resolveTerrainId(data.type)
        const center = this.getHexCenter(col, row)

        for (let edge = 0; edge < 6; edge++) {
          const nb = this.getNeighbor(col, row, edge)
          if (nb.c < 1 || nb.c > this.CONFIG.gridW || nb.r < 1 || nb.r > this.CONFIG.gridH) continue

          const nKey = `${nb.c}_${nb.r}`
          const nData = hexData[nKey]
          if (!nData) continue

          const nTypeId = this.resolveTerrainId(nData.type)
          if (nTypeId === typeId) continue

          // Process each shared edge only once
          const edgeId = col < nb.c || (col === nb.c && row < nb.r)
            ? `${col}_${row}_${nb.c}_${nb.r}`
            : `${nb.c}_${nb.r}_${col}_${row}`
          if (processedEdges.has(edgeId)) continue
          processedEdges.add(edgeId)

          const nCenter = this.getHexCenter(nb.c, nb.r)
          const config = this.terrainIdMap[typeId]
          const nConfig = this.terrainIdMap[nTypeId]
          if (!config || !nConfig) continue

          // Edge vertices
          const v0x = center.x + drawSize * Math.cos(angle * edge)
          const v0y = center.y + drawSize * Math.sin(angle * edge)
          const v1x = center.x + drawSize * Math.cos(angle * ((edge + 1) % 6))
          const v1y = center.y + drawSize * Math.sin(angle * ((edge + 1) % 6))

          // Inward direction into each hex
          const edgeMidX = (v0x + v1x) / 2
          const edgeMidY = (v0y + v1y) / 2

          // Use noise at edge midpoint to decide which terrain extends (consistent per edge)
          const dirNoise = this.blendNoise(edgeMidX * 0.73, edgeMidY * 0.73, 0.04)

          // Source = terrain that extends, dest = hex that receives the spill
          let srcTypeId: number, srcCenter: { x: number; y: number }
          let destCenter: { x: number; y: number }
          let inwardDx: number, inwardDy: number

          if (dirNoise > 0.5) {
            // Current hex extends into neighbor
            srcTypeId = typeId
            srcCenter = center
            destCenter = nCenter
            inwardDx = nCenter.x - edgeMidX
            inwardDy = nCenter.y - edgeMidY
          } else {
            // Neighbor extends into current hex
            srcTypeId = nTypeId
            srcCenter = nCenter
            destCenter = center
            inwardDx = center.x - edgeMidX
            inwardDy = center.y - edgeMidY
          }

          const inLen = Math.sqrt(inwardDx * inwardDx + inwardDy * inwardDy) || 1
          const inX = inwardDx / inLen
          const inY = inwardDy / inLen

          const srcConfig = this.terrainIdMap[srcTypeId]
          if (!srcConfig) continue

          // Build noise-perturbed spill path:
          // - One side follows the hex edge (v0 → v1)
          // - Other side is a noise-curved line offset inward into dest hex
          // This creates a tongue/strip shape

          // Generate the inner boundary points (noise-perturbed)
          const innerPoints: { x: number; y: number }[] = []
          for (let p = 0; p <= curvePoints; p++) {
            const t = p / curvePoints
            const ex = v0x + (v1x - v0x) * t
            const ey = v0y + (v1y - v0y) * t

            // Multi-octave noise for organic, varied boundary
            const n1 = this.blendNoise(ex, ey, 0.04)          // large-scale shape
            const n2 = this.blendNoise(ex + 400, ey + 400, 0.1)  // medium detail
            const n3 = this.blendNoise(ex + 800, ey + 200, 0.2)  // fine detail
            const noise = n1 * 0.45 + n2 * 0.35 + n3 * 0.2

            // Vary depth more dramatically — some spots barely spill, others go deep
            const depth = maxSpill * (noise * noise * 1.5 + 0.05)  // squared for more contrast

            // Taper at the ends of the edge, but less aggressively
            const edgeFade = Math.pow(Math.sin(t * Math.PI), 0.6)  // flatter plateau, softer taper
            const finalDepth = depth * edgeFade

            innerPoints.push({
              x: ex + inX * finalDepth,
              y: ey + inY * finalDepth
            })
          }

          // Also generate a deeper fringe boundary (for soft alpha fade)
          const fringePoints: { x: number; y: number }[] = []
          for (let p = 0; p <= curvePoints; p++) {
            const ip = innerPoints[p]!
            const t2 = p / curvePoints
            const ex2 = v0x + (v1x - v0x) * t2
            const ey2 = v0y + (v1y - v0y) * t2
            // Fringe extends 50% further than the inner boundary
            fringePoints.push({
              x: ip.x + (ip.x - ex2) * 0.5,
              y: ip.y + (ip.y - ey2) * 0.5
            })
          }

          const srcImg = this.terrainImages[srcTypeId]
          const srcColor = srcConfig.color || '#789'

          // Pass A: Draw soft fringe (outer zone, low alpha)
          this.ctx.save()
          this.ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            this.ctx.lineTo(
              destCenter.x + drawSize * Math.cos(angle * i),
              destCenter.y + drawSize * Math.sin(angle * i)
            )
          }
          this.ctx.closePath()
          this.ctx.clip()

          this.ctx.beginPath()
          this.ctx.moveTo(v0x, v0y)
          this.ctx.lineTo(v1x, v1y)
          for (let p = curvePoints; p >= 0; p--) {
            this.ctx.lineTo(fringePoints[p]!.x, fringePoints[p]!.y)
          }
          this.ctx.closePath()
          this.ctx.clip()

          this.ctx.globalAlpha = 0.35
          if (srcImg) {
            const imgSize = size * 2.5
            this.ctx.drawImage(srcImg, srcCenter.x - imgSize / 2, srcCenter.y - imgSize / 2, imgSize, imgSize)
          } else {
            this.ctx.fillStyle = srcColor
            this.ctx.fill()
          }
          this.ctx.restore()

          // Pass B: Draw solid core (inner zone, full alpha)
          this.ctx.save()
          this.ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            this.ctx.lineTo(
              destCenter.x + drawSize * Math.cos(angle * i),
              destCenter.y + drawSize * Math.sin(angle * i)
            )
          }
          this.ctx.closePath()
          this.ctx.clip()

          this.ctx.beginPath()
          this.ctx.moveTo(v0x, v0y)
          this.ctx.lineTo(v1x, v1y)
          for (let p = curvePoints; p >= 0; p--) {
            this.ctx.lineTo(innerPoints[p]!.x, innerPoints[p]!.y)
          }
          this.ctx.closePath()
          this.ctx.clip()

          this.ctx.globalAlpha = 0.85
          if (srcImg) {
            const imgSize = size * 2.5
            this.ctx.drawImage(srcImg, srcCenter.x - imgSize / 2, srcCenter.y - imgSize / 2, imgSize, imgSize)
          } else {
            this.ctx.fillStyle = srcColor
            this.ctx.fill()
          }
          this.ctx.restore()
        }
      }
    }
  }

  // === Path rendering (roads, rivers) ===

  private getPathStyle(type: MapPathType): { color: string; width: number; dash: number[] } {
    switch (type) {
      case 'road-solid':
        return { color: '#8B7355', width: 3, dash: [] }
      case 'road-dotted':
        return { color: '#8B7355', width: 3, dash: [8, 6] }
      case 'river':
        return { color: '#4A90D9', width: 3.5, dash: [] }
      default:
        return { color: '#888', width: 2, dash: [] }
    }
  }

  private drawSinglePath(points: { x: number; y: number }[], style: { color: string; width: number; dash: number[] }): void {
    if (points.length < 2) return
    const ctx = this.ctx

    ctx.save()
    ctx.strokeStyle = style.color
    // Constant width independent of zoom
    ctx.lineWidth = style.width / this.camera.zoom
    ctx.setLineDash(style.dash.map(d => d / this.camera.zoom))
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(points[0]!.x, points[0]!.y)

    if (points.length === 2) {
      ctx.lineTo(points[1]!.x, points[1]!.y)
    } else {
      // Smooth curve through waypoints using quadratic bezier
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i]!
        const next = points[i + 1]!
        const midX = (curr.x + next.x) / 2
        const midY = (curr.y + next.y) / 2
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
      }
      // Final segment to last point
      const last = points[points.length - 1]!
      ctx.lineTo(last.x, last.y)
    }

    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  drawPaths(paths: MapPath[]): void {
    for (const path of paths) {
      if (path.points.length < 2) continue
      const style = this.getPathStyle(path.type)
      this.drawSinglePath(path.points, style)
    }
  }

  drawPathPreview(preview: { type: MapPathType; points: { x: number; y: number }[]; cursor?: { x: number; y: number } }): void {
    const allPoints = [...preview.points]
    if (preview.cursor && allPoints.length > 0) {
      allPoints.push(preview.cursor)
    }
    if (allPoints.length < 2) {
      // Draw single waypoint dot
      if (allPoints.length === 1) {
        const ctx = this.ctx
        ctx.save()
        const r = 4 / this.camera.zoom
        ctx.fillStyle = '#ef233c'
        ctx.beginPath()
        ctx.arc(allPoints[0]!.x, allPoints[0]!.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      return
    }

    const style = this.getPathStyle(preview.type)
    // Draw with reduced opacity for preview
    const previewStyle = { ...style, color: style.color + 'AA' }
    this.drawSinglePath(allPoints, previewStyle)

    // Draw waypoint dots
    const ctx = this.ctx
    ctx.save()
    const r = 3 / this.camera.zoom
    for (const pt of preview.points) {
      ctx.fillStyle = '#ef233c'
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
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
      // Pan — skip left-drag pan when disableLeftDragPan is set (draw mode)
      if (this.isPanning || (this.isLeftMouseDown && !this.disableLeftDragPan)) {
        this.camera.x += dx
        this.camera.y += dy
        this.container.style.cursor = 'grabbing'
        if (this.onCameraChange) this.onCameraChange()
      }
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

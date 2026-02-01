/**
 * Icon paths and preloading utilities for PNG-based icons.
 * Replaces emoji-based typeIcons throughout the app.
 */

export const locationTypeIcons: Record<string, string> = {
  city: '/icons/locations/city.png',
  town: '/icons/locations/town.png',
  village: '/icons/locations/village.png',
  castle: '/icons/locations/castle.png',
  fortress: '/icons/locations/fortress.png',
  monastery: '/icons/locations/monastery.png',
  camp: '/icons/locations/camp.png',
  ruins: '/icons/locations/ruins.png',
  other: '/icons/locations/other.png',
}

export const featureTypeIcons: Record<string, string> = {
  inn: '/icons/features/inn.png',
  shop: '/icons/features/shop.png',
  temple: '/icons/features/temple.png',
  shrine: '/icons/features/shrine.png',
  blacksmith: '/icons/features/blacksmith.png',
  tavern: '/icons/features/tavern.png',
  guild: '/icons/features/guild.png',
  market: '/icons/features/market.png',
  gate: '/icons/features/gate.png',
  tower: '/icons/features/tower.png',
  ruins: '/icons/features/ruins.png',
  cave: '/icons/features/cave.png',
  dock: '/icons/features/dock.png',
  warehouse: '/icons/features/warehouse.png',
  barracks: '/icons/features/barracks.png',
  library: '/icons/features/library.png',
  other: '/icons/features/other.png',
  // Types without a dedicated icon fall back to 'other'
  bridge: '/icons/features/other.png',
  well: '/icons/features/other.png',
  monument: '/icons/features/other.png',
  graveyard: '/icons/features/other.png',
}

export const markerTypeIcons: Record<string, string> = {
  clue: '/icons/markers/clue.png',
  battle: '/icons/markers/battle.png',
  danger: '/icons/markers/danger.png',
  puzzle: '/icons/markers/puzzle.png',
  mystery: '/icons/markers/mystery.png',
  waypoint: '/icons/markers/waypoint.png',
  quest: '/icons/markers/quest.png',
  locked: '/icons/markers/locked.png',
  unlocked: '/icons/markers/unlocked.png',
}

/** All icon paths combined for convenience */
export const allTypeIcons: Record<string, string> = {
  ...locationTypeIcons,
  ...featureTypeIcons,
  ...markerTypeIcons,
}

/**
 * Get the icon path for a given type, checking all categories.
 * Falls back to the location 'other' icon.
 */
export function getIconPath(type: string): string {
  return allTypeIcons[type] || locationTypeIcons['other'] || '/icons/locations/other.png'
}

// --- Canvas icon preloader for hexMap.ts ---

const iconImageCache: Record<string, HTMLImageElement> = {}
let preloadPromise: Promise<void> | null = null

/**
 * Preload all icon images into HTMLImageElement cache.
 * Returns a promise that resolves when all are loaded (or failed).
 * Safe to call multiple times — only loads once.
 */
export function preloadIcons(): Promise<void> {
  if (preloadPromise) return preloadPromise

  const allPaths = new Set<string>([
    ...Object.values(locationTypeIcons),
    ...Object.values(featureTypeIcons),
    ...Object.values(markerTypeIcons),
  ])

  preloadPromise = new Promise<void>((resolve) => {
    let remaining = allPaths.size
    if (remaining === 0) { resolve(); return }

    function done() {
      remaining--
      if (remaining <= 0) resolve()
    }

    allPaths.forEach((path) => {
      if (iconImageCache[path]) { done(); return }
      const img = new Image()
      img.src = path
      img.onload = () => { iconImageCache[path] = img; done() }
      img.onerror = () => { console.warn(`Failed to load icon: ${path}`); done() }
    })
  })

  return preloadPromise
}

/**
 * Get a preloaded HTMLImageElement for a given icon path.
 * Returns null if not yet loaded.
 */
export function getIconImage(path: string): HTMLImageElement | null {
  return iconImageCache[path] || null
}

/**
 * Get a preloaded icon image for a type name.
 */
export function getIconImageForType(type: string): HTMLImageElement | null {
  const path = getIconPath(type)
  return iconImageCache[path] || null
}

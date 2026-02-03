/**
 * Shared composable for fetching entity data for mention tooltips.
 * Caches docs in memory to avoid repeated fetches.
 */

import { reactive } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { MentionKind } from '../lib/mentionRenderer'

interface TooltipData {
  loading: boolean
  name?: string
  description?: string
  race?: string
  class?: string
  level?: number
  type?: string
  tags?: string[]
  kind: MentionKind
}

const cache = new Map<string, TooltipData>()
const pending = new Set<string>()

function collectionForKind(kind: MentionKind): string | null {
  switch (kind) {
    case 'char': return 'characters'
    case 'npc': return 'npcs'
    case 'location': return 'locations'
    case 'feature': return 'features'
    case 'org': return 'organizations'
    default: return null
  }
}

function buildTooltip(kind: MentionKind, data: Record<string, any>): TooltipData {
  switch (kind) {
    case 'char':
      return {
        loading: false, kind,
        name: data.name,
        race: data.race,
        class: data.class,
        level: data.level,
      }
    case 'npc':
      return {
        loading: false, kind,
        name: data.name,
        tags: data.tags,
      }
    case 'location':
      return {
        loading: false, kind,
        name: data.name,
        type: data.type,
        description: data.description?.substring(0, 150),
      }
    case 'feature':
      return {
        loading: false, kind,
        name: data.name,
        type: data.type,
        description: data.description?.substring(0, 150),
      }
    case 'org':
      return {
        loading: false, kind,
        name: data.name,
        description: data.description?.substring(0, 150),
      }
    default:
      return { loading: false, kind, name: data.name }
  }
}

// Reactive state so Vue can track changes
const tooltipState = reactive<{ current: TooltipData | null; x: number; y: number; visible: boolean }>({
  current: null,
  x: 0,
  y: 0,
  visible: false,
})

let hideTimeout: ReturnType<typeof setTimeout> | null = null

async function fetchEntity(kind: MentionKind, id: string): Promise<TooltipData> {
  const key = `${kind}:${id}`
  if (cache.has(key)) return cache.get(key)!
  if (pending.has(key)) return { loading: true, kind }

  pending.add(key)
  const col = collectionForKind(kind)
  if (!col) {
    const fallback: TooltipData = { loading: false, kind }
    cache.set(key, fallback)
    pending.delete(key)
    return fallback
  }

  try {
    const snap = await getDoc(doc(db, col, id))
    const data = snap.exists() ? buildTooltip(kind, snap.data()) : { loading: false, kind, name: '(not found)' }
    cache.set(key, data)
    return data
  } catch {
    const fallback: TooltipData = { loading: false, kind, name: '(error)' }
    cache.set(key, fallback)
    return fallback
  } finally {
    pending.delete(key)
  }
}

export function showTooltip(kind: MentionKind, id: string, x: number, y: number) {
  if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null }

  const key = `${kind}:${id}`
  const cached = cache.get(key)

  if (cached) {
    tooltipState.current = cached
    tooltipState.x = x
    tooltipState.y = y
    tooltipState.visible = true
  } else {
    tooltipState.current = { loading: true, kind }
    tooltipState.x = x
    tooltipState.y = y
    tooltipState.visible = true

    fetchEntity(kind, id).then(data => {
      // Only update if still showing same entity
      if (tooltipState.visible && tooltipState.current?.kind === kind) {
        tooltipState.current = data
      }
    })
  }
}

export function hideTooltip() {
  hideTimeout = setTimeout(() => {
    tooltipState.visible = false
    tooltipState.current = null
  }, 100)
}

export function keepTooltip() {
  if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null }
}

export function useEntityTooltip() {
  return { tooltipState, showTooltip, hideTooltip, keepTooltip }
}

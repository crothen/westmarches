import { ref, computed } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { locationTypeIcons, featureTypeIcons, markerTypeIcons } from '../lib/icons'

export interface TypeOption {
  key: string
  label: string
  iconUrl: string
}

interface TypeEntry {
  label: string
  iconUrl: string
}

interface MarkerTypesConfig {
  locationTypes: Record<string, TypeEntry>
  featureTypes: Record<string, TypeEntry>
  hexMarkerTypes: Record<string, TypeEntry>
}

// --- Shared singleton state ---
const rawConfig = ref<MarkerTypesConfig | null>(null)
const loaded = ref(false)
let unsub: (() => void) | null = null

function buildDefaults(): MarkerTypesConfig {
  const locationTypes: Record<string, TypeEntry> = {}
  for (const [key, path] of Object.entries(locationTypeIcons)) {
    locationTypes[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), iconUrl: path }
  }
  const featureTypes: Record<string, TypeEntry> = {}
  for (const [key, path] of Object.entries(featureTypeIcons)) {
    featureTypes[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), iconUrl: path }
  }
  const hexMarkerTypes: Record<string, TypeEntry> = {}
  for (const [key, path] of Object.entries(markerTypeIcons)) {
    hexMarkerTypes[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), iconUrl: path }
  }
  return { locationTypes, featureTypes, hexMarkerTypes }
}

function startListening() {
  if (unsub) return
  const defaults = buildDefaults()
  rawConfig.value = defaults

  unsub = onSnapshot(doc(db, 'config', 'markerTypes'), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as MarkerTypesConfig
      rawConfig.value = {
        locationTypes: { ...defaults.locationTypes, ...data.locationTypes },
        featureTypes: { ...defaults.featureTypes, ...data.featureTypes },
        hexMarkerTypes: { ...defaults.hexMarkerTypes, ...data.hexMarkerTypes }
      }
    }
    loaded.value = true
  }, () => {
    // On error, keep defaults
    loaded.value = true
  })
}

function toOptions(record: Record<string, TypeEntry>): TypeOption[] {
  return Object.entries(record)
    .map(([key, entry]) => ({ key, label: entry.label, iconUrl: entry.iconUrl }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function useTypeConfig() {
  if (!loaded.value && !unsub) {
    startListening()
  }

  const locationTypes = computed(() => toOptions(rawConfig.value?.locationTypes || {}))
  const featureTypes = computed(() => toOptions(rawConfig.value?.featureTypes || {}))
  const pinTypes = computed(() => toOptions(rawConfig.value?.hexMarkerTypes || {}))

  function getIconUrl(key: string): string {
    const all = {
      ...rawConfig.value?.locationTypes,
      ...rawConfig.value?.featureTypes,
      ...rawConfig.value?.hexMarkerTypes
    }
    return all[key]?.iconUrl || '/icons/locations/other.png'
  }

  function getLabel(key: string): string {
    const all = {
      ...rawConfig.value?.locationTypes,
      ...rawConfig.value?.featureTypes,
      ...rawConfig.value?.hexMarkerTypes
    }
    return all[key]?.label || key.charAt(0).toUpperCase() + key.slice(1)
  }

  return { locationTypes, featureTypes, pinTypes, getIconUrl, getLabel, loaded }
}

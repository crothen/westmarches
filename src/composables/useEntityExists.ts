/**
 * Shared composable for tracking which entity IDs exist in Firestore.
 * Uses reference counting so multiple MentionText components share the same
 * snapshot listeners (only a handful of listeners total, regardless of component count).
 */

import { ref, onUnmounted } from 'vue'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

// Shared singleton state
const characterIds = ref<Set<string>>(new Set())
const npcIds = ref<Set<string>>(new Set())
const locationIds = ref<Set<string>>(new Set())
const featureIds = ref<Set<string>>(new Set())
const organizationIds = ref<Set<string>>(new Set())

let refCount = 0
let charUnsub: (() => void) | null = null
let npcUnsub: (() => void) | null = null
let locationUnsub: (() => void) | null = null
let featureUnsub: (() => void) | null = null
let orgUnsub: (() => void) | null = null

function startListening() {
  if (refCount === 0) {
    charUnsub = onSnapshot(collection(db, 'characters'), (snap) => {
      characterIds.value = new Set(snap.docs.map(d => d.id))
    }, (e) => console.warn('[useEntityExists] characters listener error:', e))

    npcUnsub = onSnapshot(collection(db, 'npcs'), (snap) => {
      npcIds.value = new Set(snap.docs.map(d => d.id))
    }, (e) => console.warn('[useEntityExists] npcs listener error:', e))

    locationUnsub = onSnapshot(collection(db, 'locations'), (snap) => {
      locationIds.value = new Set(snap.docs.map(d => d.id))
    }, (e) => console.warn('[useEntityExists] locations listener error:', e))

    featureUnsub = onSnapshot(collection(db, 'features'), (snap) => {
      featureIds.value = new Set(snap.docs.map(d => d.id))
    }, (e) => console.warn('[useEntityExists] features listener error:', e))

    orgUnsub = onSnapshot(collection(db, 'organizations'), (snap) => {
      organizationIds.value = new Set(snap.docs.map(d => d.id))
    }, (e) => console.warn('[useEntityExists] organizations listener error:', e))
  }
  refCount++
}

function stopListening() {
  refCount--
  if (refCount <= 0) {
    refCount = 0
    charUnsub?.()
    npcUnsub?.()
    locationUnsub?.()
    featureUnsub?.()
    orgUnsub?.()
    charUnsub = null
    npcUnsub = null
    locationUnsub = null
    featureUnsub = null
    orgUnsub = null
  }
}

/**
 * Returns reactive sets of known entity IDs.
 * Call from within a component's setup function.
 */
export function useEntityExists() {
  startListening()
  onUnmounted(() => stopListening())

  return { characterIds, npcIds, locationIds, featureIds, organizationIds }
}

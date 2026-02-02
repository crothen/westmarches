/**
 * Shared composable for tracking which entity IDs exist in Firestore.
 * Uses reference counting so multiple MentionText components share the same
 * snapshot listeners (only 2 listeners total, regardless of component count).
 */

import { ref, onUnmounted } from 'vue'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

// Shared singleton state
const characterIds = ref<Set<string>>(new Set())
const npcIds = ref<Set<string>>(new Set())
let refCount = 0
let charUnsub: (() => void) | null = null
let npcUnsub: (() => void) | null = null

function startListening() {
  if (refCount === 0) {
    charUnsub = onSnapshot(collection(db, 'characters'), (snap) => {
      characterIds.value = new Set(snap.docs.map(d => d.id))
    }, (e) => console.warn('[useEntityExists] characters listener error:', e))

    npcUnsub = onSnapshot(collection(db, 'npcs'), (snap) => {
      npcIds.value = new Set(snap.docs.map(d => d.id))
    }, (e) => console.warn('[useEntityExists] npcs listener error:', e))
  }
  refCount++
}

function stopListening() {
  refCount--
  if (refCount <= 0) {
    refCount = 0
    charUnsub?.()
    npcUnsub?.()
    charUnsub = null
    npcUnsub = null
  }
}

/**
 * Returns reactive sets of known character and NPC IDs.
 * Call from within a component's setup function.
 */
export function useEntityExists() {
  startListening()
  onUnmounted(() => stopListening())

  return { characterIds, npcIds }
}

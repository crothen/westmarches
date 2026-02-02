/**
 * Entity deletion cleanup utilities.
 * When an entity is deleted, these functions remove all references to it
 * across the Firestore collections. Call BEFORE deleting the entity document.
 */

import { collection, getDocs, query, where, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Remove all references to a character across the app.
 */
export async function cleanupCharacterReferences(characterId: string): Promise<void> {
  try {
    // 1. Sessions: remove from participants array (array of objects — must load all)
    const sessionsSnap = await getDocs(collection(db, 'sessions'))
    for (const sDoc of sessionsSnap.docs) {
      const data = sDoc.data()
      const participants = data.participants || []
      const filtered = participants.filter((p: any) => p.characterId !== characterId)
      if (filtered.length !== participants.length) {
        await updateDoc(sDoc.ref, { participants: filtered })
      }
    }

    // 2. Session Entries: remove from presentParticipants (array of objects — must load all)
    const entriesSnap = await getDocs(collection(db, 'sessionEntries'))
    for (const eDoc of entriesSnap.docs) {
      const data = eDoc.data()
      const pp = data.presentParticipants || []
      const filtered = pp.filter((p: any) => p.characterId !== characterId)
      if (filtered.length !== pp.length) {
        await updateDoc(eDoc.ref, { presentParticipants: filtered })
      }
    }

    // 3. Organizations: remove from members where entityType='player' and entityId matches
    const orgsSnap = await getDocs(collection(db, 'organizations'))
    for (const oDoc of orgsSnap.docs) {
      const data = oDoc.data()
      const members = data.members || []
      const filtered = members.filter((m: any) => !(m.entityType === 'player' && m.entityId === characterId))
      if (filtered.length !== members.length) {
        await updateDoc(oDoc.ref, { members: filtered })
      }
    }
  } catch (e) {
    console.error('[cleanupCharacterReferences] Error:', e)
  }
}

/**
 * Remove all references to an NPC across the app.
 */
export async function cleanupNpcReferences(npcId: string): Promise<void> {
  try {
    // 1. Sessions: remove from npcsEncountered (string array)
    const sessionsSnap = await getDocs(query(
      collection(db, 'sessions'),
      where('npcsEncountered', 'array-contains', npcId)
    ))
    for (const sDoc of sessionsSnap.docs) {
      const data = sDoc.data()
      const filtered = (data.npcsEncountered || []).filter((id: string) => id !== npcId)
      await updateDoc(sDoc.ref, { npcsEncountered: filtered })
    }

    // 2. Session Entries: remove from npcIds (string array)
    const entriesSnap = await getDocs(query(
      collection(db, 'sessionEntries'),
      where('npcIds', 'array-contains', npcId)
    ))
    for (const eDoc of entriesSnap.docs) {
      const data = eDoc.data()
      const filtered = (data.npcIds || []).filter((id: string) => id !== npcId)
      await updateDoc(eDoc.ref, { npcIds: filtered })
    }

    // 3. Organizations: remove from members where entityType='npc' and entityId matches
    const orgsSnap = await getDocs(collection(db, 'organizations'))
    for (const oDoc of orgsSnap.docs) {
      const data = oDoc.data()
      const members = data.members || []
      const filtered = members.filter((m: any) => !(m.entityType === 'npc' && m.entityId === npcId))
      if (filtered.length !== members.length) {
        await updateDoc(oDoc.ref, { members: filtered })
      }
    }

    // 4. NPC Notes: delete all docs where npcId matches
    const notesSnap = await getDocs(query(
      collection(db, 'npcNotes'),
      where('npcId', '==', npcId)
    ))
    for (const nDoc of notesSnap.docs) {
      await deleteDoc(nDoc.ref)
    }
  } catch (e) {
    console.error('[cleanupNpcReferences] Error:', e)
  }
}

/**
 * Remove all references to a location across the app.
 */
export async function cleanupLocationReferences(locationId: string): Promise<void> {
  try {
    // 1. Sub-locations: set parentLocationId to null
    const subLocsSnap = await getDocs(query(
      collection(db, 'locations'),
      where('parentLocationId', '==', locationId)
    ))
    for (const lDoc of subLocsSnap.docs) {
      await updateDoc(lDoc.ref, { parentLocationId: null, mapPosition: null })
    }

    // 2. Session Entries: remove from linkedLocationIds
    const entriesSnap = await getDocs(query(
      collection(db, 'sessionEntries'),
      where('linkedLocationIds', 'array-contains', locationId)
    ))
    for (const eDoc of entriesSnap.docs) {
      const data = eDoc.data()
      const filtered = (data.linkedLocationIds || []).filter((id: string) => id !== locationId)
      await updateDoc(eDoc.ref, { linkedLocationIds: filtered })
    }

    // 3. Sessions: remove from locationsVisited and clear startingPoint if it references this location
    const sessionsSnap = await getDocs(collection(db, 'sessions'))
    for (const sDoc of sessionsSnap.docs) {
      const data = sDoc.data()
      const locVisited: string[] = data.locationsVisited || []
      const inVisited = locVisited.includes(locationId)
      const isStartingPoint = data.startingPointType === 'location' && data.startingPointId === locationId

      if (inVisited || isStartingPoint) {
        const updates: Record<string, any> = {}
        if (inVisited) {
          updates.locationsVisited = locVisited.filter((id: string) => id !== locationId)
        }
        if (isStartingPoint) {
          updates.startingPointId = null
          updates.startingPointType = null
          updates.startingPointName = null
        }
        await updateDoc(sDoc.ref, updates)
      }
    }
  } catch (e) {
    console.error('[cleanupLocationReferences] Error:', e)
  }
}

/**
 * Remove all references to a feature/POI across the app.
 */
export async function cleanupFeatureReferences(featureId: string): Promise<void> {
  try {
    // 1. Session Entries: remove from linkedFeatureIds
    const entriesSnap = await getDocs(query(
      collection(db, 'sessionEntries'),
      where('linkedFeatureIds', 'array-contains', featureId)
    ))
    for (const eDoc of entriesSnap.docs) {
      const data = eDoc.data()
      const filtered = (data.linkedFeatureIds || []).filter((id: string) => id !== featureId)
      await updateDoc(eDoc.ref, { linkedFeatureIds: filtered })
    }

    // 2. Sessions: clear startingPoint if it references this feature
    const sessionsSnap = await getDocs(collection(db, 'sessions'))
    for (const sDoc of sessionsSnap.docs) {
      const data = sDoc.data()
      if (data.startingPointType === 'feature' && data.startingPointId === featureId) {
        await updateDoc(sDoc.ref, {
          startingPointId: null,
          startingPointType: null,
          startingPointName: null
        })
      }
    }
  } catch (e) {
    console.error('[cleanupFeatureReferences] Error:', e)
  }
}

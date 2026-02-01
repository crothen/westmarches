/**
 * Firestore CRUD for HexMarker collection.
 */
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from './config'
import type { HexMarker } from '../types'

const COLLECTION = 'markers'

export async function getMarkers(): Promise<HexMarker[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HexMarker))
}

export async function getMarker(id: string): Promise<HexMarker | null> {
  const snap = await getDoc(doc(db, COLLECTION, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as HexMarker
}

export async function getMarkersByHex(hexKey: string): Promise<HexMarker[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('hexKey', '==', hexKey)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HexMarker))
}

export async function getMarkersByLocation(locationId: string): Promise<HexMarker[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('locationId', '==', locationId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HexMarker))
}

export async function createMarker(marker: Omit<HexMarker, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...marker,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateMarker(id: string, updates: Partial<HexMarker>): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteMarker(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

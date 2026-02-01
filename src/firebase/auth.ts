import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './config'
import type { AppUser } from '../types'

const googleProvider = new GoogleAuthProvider()

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password)

export const registerWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password)

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)

export const signOut = () => firebaseSignOut(auth)

export const onAuth = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback)

export async function getOrCreateUserProfile(user: User): Promise<AppUser> {
  const userRef = doc(db, 'users', user.uid)
  const snap = await getDoc(userRef)
  if (snap.exists()) {
    const data = snap.data() as any
    // Migrate legacy single-role to roles array
    if (!data.roles && data.role) {
      data.roles = [data.role]
      await setDoc(userRef, { roles: data.roles }, { merge: true })
    } else if (!data.roles) {
      data.roles = ['player']
      await setDoc(userRef, { roles: data.roles }, { merge: true })
    }
    return data as AppUser
  }
  const newUser: AppUser = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email || 'Adventurer',
    roles: ['player'],
    createdAt: new Date(),
  }
  await setDoc(userRef, newUser)
  return newUser
}

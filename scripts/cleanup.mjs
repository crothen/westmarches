/**
 * Clean slate using Firebase web SDK + REST delete.
 * Deletes: markers, mapPaths, locations (except Arkenshr), features, sessions, sessionEntries, npcNotes
 * Keeps: map config, NPCs, characters, organizations, Arkenshr
 */

const PROJECT_ID = 'westmarches-dnd'
const API_KEY = 'AIzaSyDpqO9qAw3sJUxMEJpUYOHwPnFV-s9gFz4'

// Chris's UID for auth
const ADMIN_UID = 'BafzpQ0kD1YswSVOEIH2yU5MhnP2'

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// Get an ID token via Firebase Auth REST API (anonymous or custom)
// Actually let's use the firebase-tools token approach
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Read refresh token from firebase-tools config
const configPath = join(homedir(), '.config/configstore/firebase-tools.json')
const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const refreshToken = config.tokens?.refresh_token

if (!refreshToken) {
  console.error('No refresh token found. Run: firebase login')
  process.exit(1)
}

// Exchange refresh token for access token
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data))
  return data.access_token
}

async function listDocs(collectionName, token) {
  const docs = []
  let pageToken = ''
  while (true) {
    const url = `${BASE}/${collectionName}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.documents) docs.push(...data.documents)
    if (data.nextPageToken) {
      pageToken = data.nextPageToken
    } else {
      break
    }
  }
  return docs
}

async function deleteDoc(docPath, token) {
  const url = `https://firestore.googleapis.com/v1/${docPath}`
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok && res.status !== 404) {
    console.warn(`  Failed to delete ${docPath}: ${res.status}`)
  }
}

async function deleteCollection(name, token, filterFn) {
  const docs = await listDocs(name, token)
  const toDelete = filterFn ? docs.filter(filterFn) : docs
  if (toDelete.length === 0) {
    console.log(`  ${name}: nothing to delete`)
    return
  }
  // Delete in parallel batches of 20
  for (let i = 0; i < toDelete.length; i += 20) {
    const batch = toDelete.slice(i, i + 20)
    await Promise.all(batch.map(d => deleteDoc(d.name, token)))
  }
  console.log(`  ${name}: deleted ${toDelete.length} docs`)
}

async function main() {
  console.log('🔑 Getting access token...')
  const token = await getAccessToken()
  console.log('✅ Authenticated\n')

  console.log('🧹 Starting clean slate...\n')

  // 1. Markers
  console.log('Markers:')
  await deleteCollection('markers', token)

  // 2. Map paths
  console.log('Map paths:')
  await deleteCollection('mapPaths', token)

  // 3. Locations (except Arkenshr)
  console.log('Locations (keeping Arkenshr):')
  const allLocs = await listDocs('locations', token)
  const arkenshr = allLocs.find(d => {
    const nameField = d.fields?.name?.stringValue || ''
    return nameField.toLowerCase().includes('arkenshr')
  })
  if (arkenshr) {
    const name = arkenshr.fields?.name?.stringValue
    console.log(`  Keeping: ${name}`)
  }
  const locsToDelete = allLocs.filter(d => d.name !== arkenshr?.name)
  if (locsToDelete.length > 0) {
    for (let i = 0; i < locsToDelete.length; i += 20) {
      const batch = locsToDelete.slice(i, i + 20)
      await Promise.all(batch.map(d => deleteDoc(d.name, token)))
    }
    console.log(`  locations: deleted ${locsToDelete.length} docs`)
  } else {
    console.log(`  locations: nothing to delete`)
  }

  // 4. Features/POIs
  console.log('Features/POIs:')
  await deleteCollection('features', token)

  // 5. Sessions
  console.log('Sessions:')
  await deleteCollection('sessions', token)

  // 6. Session entries
  console.log('Session entries:')
  await deleteCollection('sessionEntries', token)

  // 7. NPC notes
  console.log('NPC notes:')
  await deleteCollection('npcNotes', token)

  console.log('\n✅ Clean slate complete! Kept: map, NPCs, characters, organizations, Arkenshr.')
}

main().catch(e => { console.error('Error:', e); process.exit(1) })

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const PROJECT_ID = 'westmarches-dnd'
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const configPath = join(homedir(), '.config/configstore/firebase-tools.json')
const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const refreshToken = config.tokens?.refresh_token

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
  return data.access_token
}

async function main() {
  const token = await getAccessToken()
  
  // List hexNotes
  const res = await fetch(`${BASE}/hexNotes?pageSize=300`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  const docs = data.documents || []
  console.log(`Found ${docs.length} hexNotes`)
  
  for (const doc of docs) {
    const hexKey = doc.fields?.hexKey?.stringValue || '?'
    const content = doc.fields?.content?.stringValue || doc.fields?.text?.stringValue || '?'
    console.log(`  ${hexKey}: "${content.substring(0, 60)}"`)
  }

  if (docs.length > 0) {
    console.log('\nDeleting all hexNotes...')
    await Promise.all(docs.map(d => 
      fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    ))
    console.log('Done!')
  }
}

main().catch(e => { console.error(e); process.exit(1) })

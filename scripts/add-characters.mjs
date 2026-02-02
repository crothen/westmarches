import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Read the firebase CLI tokens to create application default credentials
const firebaseConfig = JSON.parse(readFileSync(
  join(process.env.HOME, '.config/configstore/firebase-tools.json'), 'utf-8'
))
const tokens = firebaseConfig.tokens

const adcCredentials = {
  type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  refresh_token: tokens.refresh_token
}
const adcPath = join(tmpdir(), 'firebase-adc.json')
writeFileSync(adcPath, JSON.stringify(adcCredentials))
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath

const app = initializeApp({ projectId: 'westmarches-dnd' })
const db = getFirestore(app)

// Check existing characters
const existingSnap = await db.collection('characters').get()
const existingNames = existingSnap.docs.map(d => d.data().name)
console.log('Existing characters:', existingNames)

// Chris's Firebase UID for userId assignment
const CHRIS_UID = 'BafzpQ0kD1YswSVOEIH2yU5MhnP2'

// Characters to add (Kainen and Vanys already exist)
const newCharacters = [
  {
    name: 'Neril Ohneflut',
    race: 'Triton',
    class: 'Rogue',
    level: 1,
    description: 'A grey-blue skinned Triton orphan from Archenshire. Found as a baby near old canals, he grew up on the streets — a natural kleptomaniac with quick wits and quicker hands. Reads people easily but keeps friendships shallow.',
    appearance: 'Ash-blue skin, grey-green eyes, black hair. Lean and wiry street kid build, leather armor, pouches dangling from belt.',
    characterUrl: 'https://www.dndbeyond.com/characters/159121543',
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'Hera Zofkaryn',
    race: 'Tiefling',
    class: 'Sorcerer',
    level: 1,
    description: 'A Tiefling sorcerer with Infernal Legacy. Wields chromatic and arcane magic with natural talent.',
    appearance: 'Tiefling woman with fiendish features, glowing arcane energy, carries a quarterstaff and crystal focus.',
    characterUrl: 'https://www.dndbeyond.com/characters/157225189',
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'Sack Scallywag Jarrow',
    race: 'Human',
    class: 'Fighter',
    level: 1,
    description: 'A 40-year-old human fighter and folk hero who believes in the sea gods. Dual-wields scimitars, judges people by actions not words, and has a weakness for hard drink.',
    appearance: 'Rugged human male, 180cm, black hair, blue eyes, weathered by sea and sun. Twin scimitars at his sides.',
    characterUrl: 'https://www.dndbeyond.com/characters/157473629',
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'Lochus Foramen',
    race: 'Unknown',
    class: 'Ranger',
    level: 1,
    description: 'A ranger of the wilderness. Character details pending.',
    appearance: '',
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
]

let added = 0
let skipped = 0

for (const char of newCharacters) {
  if (existingNames.includes(char.name)) {
    console.log(`⏭️  Skipping "${char.name}" — already exists`)
    skipped++
    continue
  }
  try {
    const ref = await db.collection('characters').add(char)
    console.log(`✅ Added "${char.name}" (${ref.id})`)
    added++
  } catch (e) {
    console.error(`❌ Failed to add "${char.name}":`, e.message)
  }
}

console.log(`\nDone! Added: ${added}, Skipped: ${skipped}`)
process.exit(0)

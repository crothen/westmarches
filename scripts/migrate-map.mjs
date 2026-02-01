import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Read the firebase CLI tokens to create application default credentials
const firebaseConfig = JSON.parse(readFileSync(
  join(process.env.HOME, '.config/configstore/firebase-tools.json'), 'utf-8'
))
const tokens = firebaseConfig.tokens

// Create a temporary ADC file
const adcCredentials = {
  type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  refresh_token: tokens.refresh_token
}
const adcPath = join(tmpdir(), 'firebase-adc.json')
writeFileSync(adcPath, JSON.stringify(adcCredentials))
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath

// Initialize with application default credentials
const app = initializeApp({
  projectId: 'westmarches-dnd'
})

const db = getFirestore(app)

async function migrate() {
  console.log('Starting migration...')
  console.log('Using Firebase Admin SDK with Firebase CLI credentials')

  // Write default terrain config
  const defaultTerrain = {
    "Water": { id: 1, color: "#4a90a4", texture: "water.PNG", scale: 0.5 },
    "Pale": { id: 2, color: "#c8b88a", texture: "pale.PNG", scale: 0.5 },
    "Forest": { id: 3, color: "#2d6a2d", texture: "forest.PNG", scale: 0.5 },
    "Mountain": { id: 4, color: "#8a8a8a", texture: "mountain.PNG", scale: 0.5 },
    "Swamp": { id: 5, color: "#4a6a4a", texture: "swamp.PNG", scale: 0.5 },
    "Plains": { id: 6, color: "#a4c44a", texture: "plains.PNG", scale: 0.5 },
    "Foothills": { id: 7, color: "#b8a472", texture: "desert.PNG", scale: 0.5 },
    "Volcano": { id: 8, color: "#c44a00", texture: "lava.PNG", scale: 0.5 },
    "Deep Water": { id: 9, color: "#2a5a7a", texture: "deep_water.PNG", scale: 0.5 },
    "Grass": { id: 10, color: "#6a9a2a", texture: "grass.PNG", scale: 0.5 },
    "Dark Grass": { id: 11, color: "#4a7a1a", texture: "dark_grass.PNG", scale: 0.5 },
    "Dark Forest": { id: 12, color: "#1a4a1a", texture: "dark_forest.PNG", scale: 0.5 },
    "Desert": { id: 13, color: "#d4b44a", texture: "desert.PNG", scale: 0.5 },
    "Wasteland": { id: 14, color: "#7a6a4a", texture: "wasteland.PNG", scale: 0.5 },
    "Lava": { id: 15, color: "#ff4400", texture: "lava.PNG", scale: 0.5 },
    "Lava Rock": { id: 16, color: "#4a3a2a", texture: "lava_rock.PNG", scale: 0.5 },
    "Ice": { id: 17, color: "#c4daf4", texture: "ice.PNG", scale: 0.5 }
  }
  await db.doc('config/terrain').set(defaultTerrain)
  console.log('✅ Written config/terrain to target')

  // Write default tags config
  const defaultTags = {
    "Alert": { id: 1, texture: "alert.png" },
    "Blacksmith": { id: 2, texture: "blacksmith.png" },
    "Boar": { id: 3, texture: "boar.png" },
    "Boss": { id: 4, texture: "boss.png" },
    "Cabin": { id: 5, texture: "cabin.png" },
    "Camp": { id: 6, texture: "camp.png" },
    "Castle": { id: 7, texture: "castle.png" },
    "Castle Tower": { id: 8, texture: "castle-tower.png" },
    "Cave": { id: 9, texture: "cave.png" },
    "Chest": { id: 10, texture: "chest.png" },
    "City": { id: 11, texture: "city.png" },
    "Clue": { id: 12, texture: "clue.png" },
    "Deer": { id: 13, texture: "deer.png" },
    "Dragon": { id: 14, texture: "dragon.png" },
    "Dungeon": { id: 15, texture: "dungeon.png" },
    "Farm": { id: 16, texture: "farm.png" },
    "Holy Spirit": { id: 17, texture: "holy-spirit.png" },
    "Info": { id: 18, texture: "info.png" },
    "Inn": { id: 19, texture: "inn.png" },
    "Island": { id: 20, texture: "island.png" },
    "Kraken": { id: 21, texture: "kraken.png" },
    "Landmark": { id: 22, texture: "landmark.png" },
    "Locked": { id: 23, texture: "locked.png" },
    "Merchant": { id: 24, texture: "merchant.png" },
    "Message": { id: 25, texture: "message.png" },
    "Mine": { id: 26, texture: "mine.png" },
    "Money Bag": { id: 27, texture: "money-bag.png" },
    "Mystery": { id: 28, texture: "mystery.png" },
    "Portal": { id: 29, texture: "portal.png" },
    "Quest": { id: 30, texture: "quest.png" },
    "Ruins": { id: 31, texture: "ruins.png" },
    "Scrolls": { id: 32, texture: "scrolls.png" },
    "Ship": { id: 33, texture: "ship.png" },
    "Shipwreck": { id: 34, texture: "shipwreck.png" },
    "Shop": { id: 35, texture: "shop.png" },
    "Store": { id: 36, texture: "store.png" },
    "Swords": { id: 37, texture: "swords.png" },
    "Temple": { id: 38, texture: "temple.png" },
    "Unlocked": { id: 39, texture: "unlocked.png" },
    "Village": { id: 40, texture: "village.png" },
    "Volcano": { id: 41, texture: "volcano.png" },
    "Writing": { id: 42, texture: "writing.png" }
  }
  await db.doc('config/tags').set(defaultTags)
  console.log('✅ Written config/tags to target')

  // Generate map from seed data
  await generateFromSeed()

  console.log('\n🎉 Migration complete!')
  process.exit(0)
}

async function generateFromSeed() {
  // Read the seed file
  const seedContent = readFileSync('/tmp/dnd-interactive-map/public/js/MapSeed.js', 'utf-8')
  
  // Extract SEED_GRID array
  const gridMatch = seedContent.match(/const SEED_GRID = (\[[\s\S]*?\]);/)
  if (!gridMatch) throw new Error('Could not parse SEED_GRID from MapSeed.js')
  const SEED_GRID = JSON.parse(gridMatch[1])
  
  const hexes = {}
  const width = 50, height = 50
  for (let x = 1; x <= width; x++) {
    for (let y = 1; y <= height; y++) {
      const key = `${x}_${y}`
      const terrainId = (y - 1 < SEED_GRID.length && x - 1 < SEED_GRID[y-1].length) 
        ? SEED_GRID[y-1][x-1] : 1
      hexes[key] = {
        type: terrainId,
        tags: [],
        notes: [],
        privateNotes: [],
        playerNotes: {}
      }
    }
  }
  await db.doc('maps/world').set({ hexes })
  console.log(`✅ Generated and written maps/world with ${Object.keys(hexes).length} hexes from seed`)
}

migrate().catch(e => {
  console.error('Migration failed:', e)
  process.exit(1)
})

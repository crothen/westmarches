import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'fs'

const envContent = readFileSync('/home/chris/.openclaw/workspace/westmarches/.env', 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.includes('=')).map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
})

const db = getFirestore(app)

const missions = [
  // Lizardfolk Defense Unit
  { unitName: "Lizardfolk Defense Unit", tier: 2, description: "Protect a delivery of supplies to the Lizard Bay Military Camp", expectedDurationDays: 4, missionDurationDays: 2, pay: { amount: 14, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Lizardfolk Defense Unit", tier: 3, description: "Push the Lizardfolk off the Fieldcastle graveyard and secure it", expectedDurationDays: 5, missionDurationDays: 1, pay: { amount: 18, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Lizardfolk Defense Unit", tier: 3, description: "Push the Lizardfolk out of Jhiggo's Mill", expectedDurationDays: 7, missionDurationDays: 1, pay: { amount: 22, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Lizardfolk Defense Unit", tier: 4, description: "Explore the Pyramid discovered in the Rotten Waters", expectedDurationDays: 13, missionDurationDays: 3, pay: { amount: 80, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Lizardfolk Defense Unit", tier: 4, description: "A labour camp holding humanoids run by Lizardfolk has been spotted in the Rotten Waters. Free the hostages and return them to Field Castle safely.", expectedDurationDays: 15, missionDurationDays: 1, pay: { amount: 48, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Lizardfolk Defense Unit", tier: 4, description: "Infiltrate the taken over Zenterian Manor", expectedDurationDays: 13, missionDurationDays: 1, pay: { amount: 44, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Lizardfolk Defense Unit", tier: 5, description: "Infiltrate the city of Downpour and extract information about Lizardfolk society, magic and religion", durationNote: "Unknown, up to 1 month or longer", pay: { amount: 50, type: "each", currency: "gold", note: "Performance-based, most likely more than 50 gold each" }, status: "available" },

  // Dragon Defense Unit
  { unitName: "Dragon Defense Unit", tier: 2, description: "Accompany a local merchant, Paol Renan, to the North Pass", expectedDurationDays: 10, missionDurationDays: 5, pay: { amount: 35, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Dragon Defense Unit", tier: 2, description: "Forge an alliance with the leaders of Mosswall, a council of three", expectedDurationDays: 13, missionDurationDays: 1, pay: { amount: 17, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Dragon Defense Unit", tier: 2, description: "Forge an alliance with the leader of Westkeep, a merchant called Faustus Sexus", expectedDurationDays: 13, missionDurationDays: 1, pay: { amount: 17, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Dragon Defense Unit", tier: 3, description: "Scout out the southern part of Surol Island and mark the key locations on a map", expectedDurationDays: 31, missionDurationDays: 7, pay: { amount: 118, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Dragon Defense Unit", tier: 3, description: "Scout out the northern part of Surol Island and mark the key locations on a map", expectedDurationDays: 31, missionDurationDays: 7, pay: { amount: 118, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Dragon Defense Unit", tier: 5, description: "Travel to Surol Island and kill Tyredar the Black", expectedDurationDays: 31, missionDurationDays: 7, pay: { amount: 400, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Dragon Defense Unit", tier: 5, description: "Travel to Surol Island and kill Yzzet the Beautiful", expectedDurationDays: 31, missionDurationDays: 7, pay: { amount: 400, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Dragon Defense Unit", tier: 5, description: "Travel to Surol Island and kill Rholdolorth the Mighty", expectedDurationDays: 31, missionDurationDays: 7, pay: { amount: 500, type: "each", currency: "silver" }, status: "available" },

  // Giantkin Defense Unit
  { unitName: "Giantkin Defense Unit", tier: 2, description: "A city resident named Morcan Day has gone missing in the forest north of Archenshire. Look for him.", expectedDurationDays: 5, missionDurationDays: 3, pay: { amount: 19, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Giantkin Defense Unit", tier: 3, description: "Make contact with Amulius, an old mage fighting the giants", expectedDurationDays: 5, missionDurationDays: 1, pay: { amount: 18, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Giantkin Defense Unit", tier: 3, description: "Find out what caused the magical corruption near Mankatha, the giant capital", expectedDurationDays: 9, missionDurationDays: 1, pay: { amount: 26, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Giantkin Defense Unit", tier: 3, description: "Scout out the situation around High Lake Village and Golden Pass Village", expectedDurationDays: 11, missionDurationDays: 3, pay: { amount: 46, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Giantkin Defense Unit", tier: 3, description: "Scout out the situation in Mankatha", expectedDurationDays: 15, missionDurationDays: 3, pay: { amount: 54, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Giantkin Defense Unit", tier: 4, description: "Kill the giant that has set up a home north of what was Bexley", expectedDurationDays: 7, missionDurationDays: 1, pay: { amount: 34, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Giantkin Defense Unit", tier: 4, description: "Scout out Nisog, the City of Giants", expectedDurationDays: 22, missionDurationDays: 3, pay: { amount: 98, type: "each", currency: "silver" }, status: "available" },

  // Pale Containment Unit
  { unitName: "Pale Containment Unit", tier: 2, description: "Accompany a caravan with supplies to the Monastery of Cleansing Flame, our base", expectedDurationDays: 8, missionDurationDays: 8, pay: { amount: 40, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 3, description: "Explore the suspected Pale spread in the North Pass", expectedDurationDays: 11, missionDurationDays: 6, pay: { amount: 70, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 3, description: "Scout and map out the Pale Strip and establish a base there", expectedDurationDays: 25, missionDurationDays: 10, pay: { amount: 300, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 3, description: "Scout out the village of Silva Domus", expectedDurationDays: 11, missionDurationDays: 1, pay: { amount: 30, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 3, description: "Scout out the village of Intermontem", expectedDurationDays: 11, missionDurationDays: 1, pay: { amount: 30, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 3, description: "Scout out the presumably abandoned Zenterian Siege Tower", expectedDurationDays: 15, missionDurationDays: 1, pay: { amount: 38, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 3, description: "Locate the lost Prison in the Pale Forest", expectedDurationDays: 24, missionDurationDays: 16, pay: { amount: 176, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 3, description: "Scout out the alleged conflict between the Giants and the Pale", expectedDurationDays: 17, missionDurationDays: 3, pay: { amount: 58, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 4, description: "Reach and scout out the ruins of Calidas", expectedDurationDays: 17, missionDurationDays: 9, pay: { amount: 100, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 4, description: "Explore the creature lair near Silva Domus", expectedDurationDays: 13, missionDurationDays: 1, pay: { amount: 44, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 4, description: "Scout out the founding island", expectedDurationDays: 25, missionDurationDays: 7, pay: { amount: 176, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Pale Containment Unit", tier: 5, description: "Clear a path through Giant territory to the Pale", expectedDurationDays: 28, missionDurationDays: 20, pay: { amount: 1008, type: "each", currency: "silver" }, status: "available" },

  // Enchanted Forest Defense Unit
  { unitName: "Enchanted Forest Defense Unit", tier: 2, description: "Explore the ruined Merisi Castle", expectedDurationDays: 9, missionDurationDays: 1, pay: { amount: 21, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Enchanted Forest Defense Unit", tier: 2, description: "Explore the ruined Merisi Village", expectedDurationDays: 9, missionDurationDays: 1, pay: { amount: 21, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Enchanted Forest Defense Unit", tier: 3, description: "Investigate the connection between Anhaern, the leader of Murkwell and the Sorcerers of the Enchanted Forest", expectedDurationDays: 13, missionDurationDays: 7, pay: { amount: 82, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Enchanted Forest Defense Unit", tier: 3, description: "Investigate if there are any connections between Lottie Hunt and the Sorcerers", expectedDurationDays: 21, missionDurationDays: 7, pay: { amount: 112, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Enchanted Forest Defense Unit", tier: 3, description: "Investigate if there are any connections between the Council of 9 and the Sorcerers", expectedDurationDays: 23, missionDurationDays: 7, pay: { amount: 116, type: "total", currency: "silver" }, status: "available" },
  { unitName: "Enchanted Forest Defense Unit", tier: 4, description: "Explore the ruined and standing rises in the Enchanted Forest", expectedDurationDays: 19, missionDurationDays: 11, pay: { amount: 234, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Enchanted Forest Defense Unit", tier: 5, description: "Kill the Dragon that destroyed Old Ramhorn", expectedDurationDays: 19, missionDurationDays: 1, pay: { amount: 41, type: "each", currency: "silver" }, status: "available" },

  // Undead Extermination Unit
  { unitName: "Undead Extermination Unit", tier: 2, description: "Investigate the passing of Pedia Ancus", pay: { amount: 0, type: "each", currency: "silver", note: "Pay not specified" }, status: "available" },
  { unitName: "Undead Extermination Unit", tier: 3, description: "Investigate the connection between the Archenshire Underground and Vampirism", expectedDurationDays: 1, pay: { amount: 10, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Undead Extermination Unit", tier: 3, description: "Explore the giant Zenterian Structure at the feet of the Starfall Peaks", expectedDurationDays: 3, pay: { amount: 14, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Undead Extermination Unit", tier: 4, description: "Explore Grave City", pay: { amount: 10, type: "per_day", currency: "silver" }, status: "available" },
  { unitName: "Undead Extermination Unit", tier: 4, description: "Explore the Ruined Village of Lakeview", expectedDurationDays: 11, missionDurationDays: 1, pay: { amount: 30, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Undead Extermination Unit", tier: 4, description: "Explore the Catacombs next to Lakeview", expectedDurationDays: 11, missionDurationDays: 1, pay: { amount: 30, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Undead Extermination Unit", tier: 4, description: "An area in the Rotten Waters has been discovered that contains giant undead crocodiles. Investigate the cause of this phenomenon.", expectedDurationDays: 15, pay: { amount: 0, type: "each", currency: "silver", note: "Pay not specified" }, status: "available" },

  // Vinovia Infiltration Unit
  { unitName: "Vinovia Infiltration Unit", tier: 2, description: "Travel to Vinovia to make contact with the Vinovian Church of Auris, the Vinovian City Government and possibly the Opulentam Civitatem", expectedDurationDays: 12, missionDurationDays: 1, pay: { amount: 27, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Vinovia Infiltration Unit", tier: 3, description: "Rumors of Pale Elfs in Vinovia go around. Try to find the Pale Elfs and how they got to Vinovia.", expectedDurationDays: 17, missionDurationDays: 3, pay: { amount: 58, type: "each", currency: "silver" }, status: "available" },
  { unitName: "Vinovia Infiltration Unit", tier: 5, description: "Free and take over the north-western gate of Vinovia", expectedDurationDays: 11, missionDurationDays: 3, pay: { amount: 166, type: "each", currency: "silver" }, status: "available" },
]

async function seed() {
  console.log('Clearing existing missions...')
  const existing = await getDocs(collection(db, 'missions'))
  for (const d of existing.docs) {
    await deleteDoc(d.ref)
  }
  console.log(`Cleared ${existing.size} existing missions`)

  console.log(`Seeding ${missions.length} missions...`)
  for (const m of missions) {
    await addDoc(collection(db, 'missions'), {
      ...m,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
  }
  console.log(`✅ All ${missions.length} missions seeded!`)
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { collection, query, orderBy, addDoc, updateDoc, doc, arrayUnion, Timestamp, onSnapshot } from 'firebase/firestore'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useRoles } from '../composables/useRoles'
import { useImageGen } from '../composables/useImageGen'
import { parseMentions } from '../lib/mentionRenderer'
import MentionTextarea from '../components/common/MentionTextarea.vue'
import TagInput from '../components/common/TagInput.vue'
import TypeSelect from '../components/common/TypeSelect.vue'
import { useTypeConfig } from '../composables/useTypeConfig'
import type { CampaignLocation, Npc, Character, Organization } from '../types'

const auth = useAuthStore()
const { isDm, isAdmin } = useRoles()
const { generateImage, generating: generatingImage, error: imageError } = useImageGen()
const { locationTypes: locationTypeOptions, featureTypes: featureTypeOptions } = useTypeConfig()

// --- Entity type ---
type EntityType = 'npc' | 'session' | 'location' | 'feature' | 'mission'
const entityType = ref<EntityType>('npc')
const entityTypes: { key: EntityType; label: string; icon: string }[] = [
  { key: 'npc', label: 'NPC', icon: '👤' },
  { key: 'session', label: 'Session', icon: '📖' },
  { key: 'location', label: 'Location', icon: '📍' },
  { key: 'feature', label: 'Feature', icon: '📌' },
  { key: 'mission', label: 'Mission', icon: '⚔️' },
]

// --- Shared state ---
const freeformText = ref('')
const generating = ref(false)
const saving = ref(false)
const genError = ref<string | null>(null)
const validationErrors = ref<string[]>([])
const generatedEntity = ref<Record<string, any> | null>(null)
const saveSuccess = ref(false)

// --- NPC fields ---
const npcName = ref('')
const npcRace = ref('')
const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Tiefling', 'Dragonborn', 'Orc', 'Goblin', 'Kobold', 'Other']

// --- Session fields ---
const sessionNumber = ref(1)
const sessionDate = ref('')
const sessionDmName = ref('')

// --- Location fields ---
const locationType = ref('city')
const LOCATION_TYPES = ['city', 'town', 'village', 'castle', 'fortress', 'monastery', 'camp', 'ruins', 'other']

// --- Feature fields ---
const featureType = ref('inn')
const FEATURE_TYPES = ['inn', 'shop', 'temple', 'shrine', 'blacksmith', 'tavern', 'guild', 'market', 'gate', 'tower', 'ruins', 'cave', 'bridge', 'well', 'monument', 'graveyard', 'dock', 'warehouse', 'barracks', 'library', 'other']
const featureLocationId = ref('')

// --- Mission fields ---
const missionUnitId = ref('')
const missionTier = ref(2)

// --- Lookup data ---
const locations = ref<CampaignLocation[]>([])
const npcs = ref<Npc[]>([])
const characters = ref<Character[]>([])
const organizations = ref<Organization[]>([])
const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(query(collection(db, 'locations'), orderBy('name', 'asc')), (snap) => {
    locations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
  }))
  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name', 'asc')), (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }))
  _unsubs.push(onSnapshot(query(collection(db, 'characters'), orderBy('name', 'asc')), (snap) => {
    characters.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
  }))
  _unsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    organizations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))
  }))

  // Default session DM name from current user
  sessionDmName.value = auth.appUser?.displayName || ''
})
onUnmounted(() => _unsubs.forEach(fn => fn()))

// Reset generated entity when switching type
watch(entityType, () => {
  generatedEntity.value = null
  validationErrors.value = []
  genError.value = null
  saveSuccess.value = false
})

// --- Auth gating ---
const canCreate = computed(() => {
  if (entityType.value === 'session' || entityType.value === 'mission') return isDm.value || isAdmin.value
  return auth.isAuthenticated
})

// --- Mention resolution ---
function resolveMentions(text: string): { resolvedText: string; mentionContext: string } {
  const tokens = parseMentions(text)
  let resolvedText = text
  const contextParts: string[] = []

  for (const token of tokens) {
    const prefix = token.kind === 'char' || token.kind === 'npc' ? '@' : token.kind === 'org' ? '¦' : '#'
    const rawToken = `${prefix}[${token.name}](${token.kind}:${token.id})`

    if (token.kind === 'npc') {
      const npc = npcs.value.find(n => n.id === token.id)
      resolvedText = resolvedText.replace(rawToken, token.name)
      if (npc) contextParts.push(`NPC "${npc.name}": ${npc.race || 'Unknown race'}. ${npc.description || ''}`)
    } else if (token.kind === 'char') {
      const char = characters.value.find(c => c.id === token.id)
      resolvedText = resolvedText.replace(rawToken, token.name)
      if (char) contextParts.push(`Character "${char.name}": ${char.race} ${char.class}, level ${char.level}`)
    } else if (token.kind === 'location') {
      const loc = locations.value.find(l => l.id === token.id)
      resolvedText = resolvedText.replace(rawToken, token.name)
      if (loc) contextParts.push(`Location "${loc.name}": ${loc.type}. ${loc.description || ''}`)
    } else if (token.kind === 'feature') {
      resolvedText = resolvedText.replace(rawToken, token.name)
      contextParts.push(`Feature "${token.name}" (ID: ${token.id})`)
    } else if (token.kind === 'org') {
      resolvedText = resolvedText.replace(rawToken, token.name)
      contextParts.push(`Organization "${token.name}" (ID: ${token.id})`)
    }
  }

  return {
    resolvedText,
    mentionContext: contextParts.length > 0 ? '\n\nLinked entities:\n' + contextParts.join('\n') : '',
  }
}

// --- Build entity reference context for Gemini ---
function getEntityContext(): string {
  const parts: string[] = []
  if (characters.value.length > 0) {
    parts.push('Available Characters (use @[Name](char:ID) to reference):')
    for (const c of characters.value) parts.push(`  - ${c.name} → @[${c.name}](char:${c.id})`)
  }
  if (npcs.value.length > 0) {
    parts.push('Available NPCs (use @[Name](npc:ID) to reference):')
    for (const n of npcs.value) parts.push(`  - ${n.name} → @[${n.name}](npc:${n.id})`)
  }
  if (locations.value.length > 0) {
    parts.push('Available Locations (use #[Name](location:ID) to reference):')
    for (const l of locations.value) parts.push(`  - ${l.name} → #[${l.name}](location:${l.id})`)
  }
  // Features are loaded on locations, but we can get them from mentions context
  return parts.length > 0 ? '\n\n' + parts.join('\n') : ''
}

// --- System prompts ---
function getSystemPrompt(): string {
  const base = `You are a world-building assistant for a D&D West Marches campaign. Generate structured entity data based on the user's description.

CRITICAL RULES:
- Do NOT invent lore, history, or details beyond what the user describes
- Stay strictly faithful to the provided description
- If the user mentions specific entities by name, use their exact names and IDs
- Return ONLY valid JSON, no markdown fences, no explanation text
- All string fields should be plain text (no markdown)

MENTION SYNTAX — Use these inline tags in ALL text fields (summary, description, timeline entries) whenever referencing known entities:
- Characters: @[Name](char:ID)
- NPCs: @[Name](npc:ID)
- Locations: #[Name](location:ID)
- Features: #[Name](feature:ID)
- Organizations: ¦[Name](org:ID)

Only use mention tags for entities whose IDs you know (from the provided entity list or from the user's input). Do NOT invent IDs.
`

  switch (entityType.value) {
    case 'npc':
      return base + `
Generate an NPC. JSON schema:
{
  "name": "string (required)",
  "race": "string (required)",
  "description": "string (required, detailed paragraph describing the NPC)",
  "locationEncountered": "string (optional, where they were met)",
  "tags": ["string array, relevant keywords"],
  "organizationIds": ["org document IDs from mentioned organizations, empty array if none"]
}

If a name is pre-filled, use it. If a race is pre-filled, use it. If no name is provided, you MUST generate a fitting fantasy name. Always include a name in the output.`

    case 'session':
      return base + `
Generate a session log with a timeline. JSON schema:
{
  "sessionNumber": number (required),
  "title": "string (required, evocative title for the session)",
  "date": "ISO date string (required)",
  "summary": "string (required, narrative summary of what happened, 2-4 paragraphs)",
  "dmName": "string (required)",
  "participants": [{"characterName": "string", "characterId": "ID from mentions"}],
  "locationsVisited": ["location IDs from mentions"],
  "npcsEncountered": ["NPC IDs from mentions"],
  "loot": [{"name": "string", "quantity": number, "recipient": "character name or 'party'"}],
  "tags": ["string array"],
  "timeline": [
    {
      "type": "interaction|task|encounter|discovery|travel|rest|custom" (required),
      "title": "string (required, short descriptive title for this event)",
      "description": "string (required, 1-3 sentences describing what happened)",
      "npcIds": ["NPC IDs involved in this event, from mentions"],
      "linkedLocationIds": ["location IDs relevant to this event, from mentions"],
      "linkedFeatureIds": ["feature IDs relevant to this event, from mentions"]
    }
  ]
}

The timeline should break the session into chronological events (3-8 entries typically). Each entry represents a distinct scene, encounter, or moment. Use appropriate types:
- "travel" for moving between locations
- "encounter" for combat or hostile situations
- "interaction" for conversations, negotiations, social scenes
- "discovery" for finding items, locations, secrets
- "task" for completing objectives or missions
- "rest" for resting, camping, downtime
- "custom" for anything else

IMPORTANT: In the "summary" and each timeline entry's "description", use mention tags to reference known entities inline. Examples:
- "The party met @[Gareth](npc:abc123) at #[Ironhaven](location:def456)."
- "@[Lyra](char:xyz789) struck the final blow against the ogre."
Only use mention tags for entities whose IDs are provided in the entity list or input. Do not make up IDs.

Use the pre-filled session number, date, and DM name. Extract participants, locations, and NPCs from the mentions in the text.`

    case 'location':
      return base + `
Generate a location. JSON schema:
{
  "name": "string (required)",
  "type": "${LOCATION_TYPES.join('|')}" (required),
  "description": "string (required, atmospheric description, 1-3 paragraphs)",
  "tags": ["string array, relevant keywords"]
}

Use the pre-filled type if provided.`

    case 'feature':
      return base + `
Generate a point of interest/feature. JSON schema:
{
  "name": "string (required)",
  "type": "${FEATURE_TYPES.join('|')}" (required),
  "description": "string (required, atmospheric description)",
  "locationId": "parent location ID if mentioned, null otherwise",
  "tags": ["string array, relevant keywords"]
}

Use the pre-filled type and parent location if provided.`

    case 'mission':
      return base + `
Generate a mission for the missions board. JSON schema:
{
  "title": "string (required, concise mission title)",
  "description": "string (required, 2-4 sentences describing the mission objective, context, and any known dangers)",
  "tier": number (required, 2-5, difficulty tier),
  "expectedDurationDays": number or null (optional, estimated total duration in days),
  "missionDurationDays": number or null (optional, active mission time in days),
  "durationNote": "string or null (optional, e.g. 'unknown', 'up to 1 month')",
  "pay": {
    "amount": number (required, payment amount),
    "type": "each|total|per_day|performance" (required),
    "currency": "gold|silver" (required),
    "note": "string or null (optional, payment clarification)"
  }
}

Tier guidelines:
- T2: Straightforward tasks for small groups, minor danger
- T3: Moderate difficulty, combat expected, some planning needed
- T4: Dangerous, requires experienced adventurers, significant threats
- T5: Extremely dangerous, elite-level challenges, high stakes

Use the pre-filled tier and unit/organization if provided. Generate realistic pay scaled to the tier and danger level.`

    default:
      return base
  }
}

function getUserPrompt(): string {
  const { resolvedText, mentionContext } = resolveMentions(freeformText.value)
  const mentions = parseMentions(freeformText.value)

  // For sessions, pass raw text with mention tags so Gemini can reuse them
  const rawText = freeformText.value
  let prompt = resolvedText + mentionContext

  switch (entityType.value) {
    case 'npc': {
      if (npcName.value.trim()) prompt = `Name: ${npcName.value.trim()}\n` + prompt
      else prompt = `Name: (generate a fitting fantasy name)\n` + prompt
      if (npcRace.value) prompt = `Race: ${npcRace.value}\n` + prompt
      // Extract org IDs from mentions
      const orgIds = mentions.filter(m => m.kind === 'org').map(m => m.id)
      if (orgIds.length > 0) prompt += `\nOrganization IDs to use: ${JSON.stringify(orgIds)}`
      break
    }
    case 'session': {
      // Use raw text with mention tags so Gemini sees the format
      prompt = `Session Number: ${sessionNumber.value}\nDate: ${sessionDate.value}\nDM: ${sessionDmName.value}\n\n` + rawText
      prompt += getEntityContext()
      // Extract participant char IDs
      const charMentions = mentions.filter(m => m.kind === 'char')
      if (charMentions.length > 0) {
        prompt += `\nParticipant character IDs: ${JSON.stringify(charMentions.map(m => ({ characterName: m.name, characterId: m.id })))}`
      }
      const locMentions = mentions.filter(m => m.kind === 'location')
      if (locMentions.length > 0) {
        prompt += `\nLocation IDs visited: ${JSON.stringify(locMentions.map(m => m.id))}`
      }
      const npcMentions = mentions.filter(m => m.kind === 'npc')
      if (npcMentions.length > 0) {
        prompt += `\nNPC IDs encountered: ${JSON.stringify(npcMentions.map(m => m.id))}`
      }
      break
    }
    case 'location': {
      prompt = `Type: ${locationType.value}\n\n` + prompt
      break
    }
    case 'feature': {
      prompt = `Type: ${featureType.value}\n` + prompt
      if (featureLocationId.value) {
        const loc = locations.value.find(l => l.id === featureLocationId.value)
        prompt += `\nParent location: "${loc?.name || 'Unknown'}" (ID: ${featureLocationId.value})`
      }
      break
    }
    case 'mission': {
      const org = organizations.value.find(o => o.id === missionUnitId.value)
      if (org) prompt = `Unit/Organization: ${org.name}\n` + prompt
      prompt = `Tier: ${missionTier.value}\n` + prompt
      break
    }
  }

  return prompt
}

// --- Generate ---
async function generate() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    genError.value = 'Gemini API key not configured'
    return
  }
  if (!freeformText.value.trim()) {
    genError.value = 'Please provide a description'
    return
  }

  generating.value = true
  genError.value = null
  validationErrors.value = []
  generatedEntity.value = null
  saveSuccess.value = false

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: getUserPrompt() }] }],
      systemInstruction: { role: 'system', parts: [{ text: getSystemPrompt() }] },
    })

    const responseText = result.response.text()?.trim()
    if (!responseText) {
      genError.value = 'Empty response from Gemini'
      return
    }

    // Parse JSON - strip markdown fences if present
    let jsonStr = responseText
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) jsonStr = fenceMatch[1]!.trim()

    let parsed: Record<string, any>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      genError.value = 'Failed to parse Gemini response as JSON. Raw response:\n' + responseText.substring(0, 500)
      return
    }

    // Validate
    const errors = validateEntity(parsed)
    if (errors.length > 0) {
      validationErrors.value = errors
      // Still show the entity for editing
    }

    generatedEntity.value = parsed
  } catch (e: any) {
    console.error('Generation failed:', e)
    genError.value = e.message || 'Generation failed'
  } finally {
    generating.value = false
  }
}

// --- Validation ---
function validateEntity(data: Record<string, any>): string[] {
  const errors: string[] = []

  switch (entityType.value) {
    case 'npc':
      if (!data.name?.trim()) errors.push('Missing required field: name')
      if (!data.race?.trim()) errors.push('Missing required field: race')
      if (!data.description?.trim()) errors.push('Missing required field: description')
      if (data.organizationIds && !Array.isArray(data.organizationIds)) errors.push('organizationIds must be an array')
      break
    case 'session':
      if (!data.sessionNumber) errors.push('Missing required field: sessionNumber')
      if (!data.title?.trim()) errors.push('Missing required field: title')
      if (!data.date) errors.push('Missing required field: date')
      if (!data.summary?.trim()) errors.push('Missing required field: summary')
      if (!data.dmName?.trim()) errors.push('Missing required field: dmName')
      break
    case 'location':
      if (!data.name?.trim()) errors.push('Missing required field: name')
      if (!data.type?.trim()) errors.push('Missing required field: type')
      if (!data.description?.trim()) errors.push('Missing required field: description')
      if (data.type && !LOCATION_TYPES.includes(data.type)) errors.push(`Invalid location type: ${data.type}`)
      break
    case 'feature':
      if (!data.name?.trim()) errors.push('Missing required field: name')
      if (!data.type?.trim()) errors.push('Missing required field: type')
      if (!data.description?.trim()) errors.push('Missing required field: description')
      if (data.type && !FEATURE_TYPES.includes(data.type)) errors.push(`Invalid feature type: ${data.type}`)
      break
    case 'mission':
      if (!data.title?.trim()) errors.push('Missing required field: title')
      if (!data.description?.trim()) errors.push('Missing required field: description')
      if (!data.tier || data.tier < 2 || data.tier > 5) errors.push('Tier must be between 2 and 5')
      if (!data.pay) errors.push('Missing required field: pay')
      break
  }

  if (!data.tags) data.tags = []
  if (!Array.isArray(data.tags)) {
    errors.push('tags must be an array')
    data.tags = []
  }

  return errors
}

// --- Save ---
async function save() {
  if (!generatedEntity.value) return

  saving.value = true
  genError.value = null
  saveSuccess.value = false

  try {
    const data = { ...generatedEntity.value }
    const now = Timestamp.now()

    switch (entityType.value) {
      case 'npc': {
        const docData = {
          name: data.name,
          race: data.race || '',
          description: data.description || '',
          appearance: data.appearance || '',
          locationEncountered: data.locationEncountered || '',
          tags: data.tags || [],
          organizationIds: data.organizationIds || [],
          ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
          createdAt: now,
          updatedAt: now,
        }
        const docRef = await addDoc(collection(db, 'npcs'), docData)

        // Bidirectional: update org members arrays
        const orgIds = data.organizationIds || []
        for (const orgId of orgIds) {
          try {
            await updateDoc(doc(db, 'organizations', orgId), {
              members: arrayUnion({
                entityType: 'npc',
                entityId: docRef.id,
                name: data.name,
                rank: 'member',
              }),
              updatedAt: now,
            })
          } catch (e) {
            console.warn(`Failed to update org ${orgId} members:`, e)
          }
        }
        break
      }
      case 'session': {
        const sessionDate = data.date ? Timestamp.fromDate(new Date(data.date)) : now
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          sessionNumber: data.sessionNumber,
          title: data.title,
          date: sessionDate,
          summary: data.summary || '',
          dmId: auth.firebaseUser?.uid || '',
          dmName: data.dmName || '',
          participants: data.participants || [],
          locationsVisited: data.locationsVisited || [],
          npcsEncountered: data.npcsEncountered || [],
          loot: data.loot || [],
          tags: data.tags || [],
          createdAt: now,
          updatedAt: now,
        })

        // Save timeline entries
        const timeline = data.timeline || []
        for (let i = 0; i < timeline.length; i++) {
          const entry = timeline[i]
          await addDoc(collection(db, 'sessionEntries'), {
            sessionId: sessionRef.id,
            order: i + 1,
            type: entry.type || 'custom',
            title: entry.title || '',
            description: entry.description || '',
            npcIds: entry.npcIds || [],
            linkedLocationIds: entry.linkedLocationIds || [],
            linkedFeatureIds: entry.linkedFeatureIds || [],
            allParticipantsPresent: true,
            createdBy: auth.firebaseUser?.uid || '',
            createdAt: now,
            updatedAt: now,
          })
        }
        break
      }
      case 'location': {
        await addDoc(collection(db, 'locations'), {
          name: data.name,
          type: data.type,
          description: data.description || '',
          tags: data.tags || [],
          ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
          discoveredBy: auth.firebaseUser?.uid,
          createdAt: now,
          updatedAt: now,
        })
        break
      }
      case 'feature': {
        await addDoc(collection(db, 'features'), {
          name: data.name,
          type: data.type,
          description: data.description || '',
          locationId: data.locationId || featureLocationId.value || null,
          tags: data.tags || [],
          ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
          discoveredBy: auth.firebaseUser?.uid,
          createdAt: now,
          updatedAt: now,
        })
        break
      }
      case 'mission': {
        const org = organizations.value.find(o => o.id === missionUnitId.value)
        await addDoc(collection(db, 'missions'), {
          unitId: missionUnitId.value,
          unitName: org?.name || 'Unknown Unit',
          title: data.title,
          description: data.description || '',
          tier: data.tier || missionTier.value,
          expectedDurationDays: data.expectedDurationDays || null,
          missionDurationDays: data.missionDurationDays || null,
          durationNote: data.durationNote || null,
          pay: data.pay || { amount: 0, type: 'each', currency: 'gold' },
          status: 'available',
          votes: [],
          createdAt: now,
          updatedAt: now,
        })
        break
      }
    }

    saveSuccess.value = true
    // Reset for next creation
    setTimeout(() => {
      generatedEntity.value = null
      freeformText.value = ''
      saveSuccess.value = false
      npcName.value = ''
      npcRace.value = ''
    }, 2000)
  } catch (e: any) {
    console.error('Failed to save:', e)
    genError.value = `Failed to save: ${e.message || 'Unknown error'}`
  } finally {
    saving.value = false
  }
}

// --- Generate Image ---
async function generateEntityImage() {
  if (!generatedEntity.value) return

  const data = generatedEntity.value
  let prompt = ''

  switch (entityType.value) {
    case 'npc':
      prompt = `Fantasy character portrait for a D&D RPG. ${data.name}, a ${data.race || 'unknown race'}. ${data.description || ''}. Style: detailed fantasy art, medieval setting, dramatic lighting, painterly. Head and shoulders portrait.`
      break
    case 'location':
      prompt = `Fantasy landscape for a D&D RPG. A ${data.type} called "${data.name}". ${data.description || ''}. Style: detailed fantasy art, medieval setting, dramatic lighting, painterly, wide establishing shot.`
      break
    case 'feature':
      prompt = `Fantasy interior/exterior for a D&D RPG. A ${data.type} called "${data.name}". ${data.description || ''}. Style: detailed fantasy art, medieval setting, atmospheric lighting, painterly.`
      break
    default:
      prompt = `Fantasy scene for a D&D RPG. "${data.title || data.name}". ${data.summary || data.description || ''}. Style: detailed fantasy art, medieval setting, dramatic lighting, painterly.`
  }

  const url = await generateImage(prompt, `generated/${entityType.value}s/${Date.now()}`)
  if (url) {
    generatedEntity.value = { ...generatedEntity.value!, imageUrl: url }
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">✨ Generate Entity</h1>
    </div>

    <!-- Entity Type Selector -->
    <div class="flex rounded-lg overflow-hidden border border-white/[0.08] mb-6">
      <button
        v-for="et in entityTypes" :key="et.key"
        @click="entityType = et.key"
        :class="[
          'flex-1 text-sm px-4 py-2.5 transition-all flex items-center justify-center gap-2',
          entityType === et.key
            ? 'bg-[#ef233c]/15 text-[#ef233c] font-semibold'
            : 'bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]'
        ]"
      >
        <span>{{ et.icon }}</span>
        <span>{{ et.label }}</span>
      </button>
    </div>

    <!-- Auth gate for sessions -->
    <div v-if="!canCreate" class="card p-10 text-center relative z-10">
      <div class="relative z-10">
        <p class="text-zinc-500">🔒 Session creation requires DM or Admin role.</p>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Structured Fields -->
      <div class="card p-5 relative z-10">
        <div class="relative z-10">
          <h3 class="text-sm font-semibold text-zinc-400 mb-3" style="font-family: Manrope, sans-serif">
            {{ entityType === 'npc' ? '👤 NPC Details' : entityType === 'session' ? '📖 Session Details' : entityType === 'location' ? '📍 Location Details' : entityType === 'feature' ? '📌 Feature Details' : '⚔️ Mission Details' }}
          </h3>

          <!-- NPC fields -->
          <div v-if="entityType === 'npc'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label text-xs mb-1 block">Name <span class="text-zinc-600">(optional — AI can generate)</span></label>
              <input v-model="npcName" class="input w-full" placeholder="Leave blank for AI to generate" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">Race</label>
              <select v-model="npcRace" class="input w-full">
                <option value="">— AI decides —</option>
                <option v-for="r in RACES" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
          </div>

          <!-- Session fields -->
          <div v-else-if="entityType === 'session'" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="label text-xs mb-1 block">Session #</label>
              <input v-model.number="sessionNumber" type="number" min="1" class="input w-full" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">Date</label>
              <input v-model="sessionDate" type="date" class="input w-full" @click="($event.target as HTMLInputElement).showPicker?.()" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">DM Name</label>
              <input v-model="sessionDmName" class="input w-full" />
            </div>
          </div>

          <!-- Location fields -->
          <div v-else-if="entityType === 'location'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label text-xs mb-1 block">Type</label>
              <TypeSelect v-model="locationType" :options="locationTypeOptions" input-class="w-full" />
            </div>
          </div>

          <!-- Feature fields -->
          <div v-else-if="entityType === 'feature'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label text-xs mb-1 block">Type</label>
              <TypeSelect v-model="featureType" :options="featureTypeOptions" input-class="w-full" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">Parent Location</label>
              <select v-model="featureLocationId" class="input w-full">
                <option value="">— None (standalone) —</option>
                <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
              </select>
            </div>
          </div>

          <!-- Mission fields -->
          <div v-else-if="entityType === 'mission'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label text-xs mb-1 block">Unit / Organization</label>
              <select v-model="missionUnitId" class="input w-full">
                <option value="" disabled>Select unit...</option>
                <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
              </select>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Tier (2-5)</label>
              <input v-model.number="missionTier" type="number" min="2" max="5" class="input w-full" />
            </div>
          </div>
        </div>
      </div>

      <!-- Freeform Description -->
      <div class="card p-5 relative z-10">
        <div class="relative z-10">
          <h3 class="text-sm font-semibold text-zinc-400 mb-1" style="font-family: Manrope, sans-serif">📝 Description</h3>
          <p class="text-xs text-zinc-600 mb-3">
            Describe the entity. Use <span class="text-blue-400">@</span> for characters/NPCs, <span class="text-green-400">#</span> for locations/features, <span class="text-rose-400">¦</span> for organizations.
          </p>
          <MentionTextarea
            v-model="freeformText"
            :rows="6"
            :placeholder="entityType === 'npc'
              ? 'A grizzled dwarf blacksmith who runs a forge in #[Ironhaven](location:xxx). Member of ¦[The Iron Guild](org:xxx)...'
              : entityType === 'session'
                ? 'The party traveled to #[Blackthorn Keep](location:xxx) and met @[Gareth](npc:xxx). They fought goblins and found treasure...'
                : entityType === 'location'
                  ? 'A fortified trading town at the crossroads of two major trade routes. Known for its bustling market...'
                  : 'A cozy tavern with a roaring fireplace, run by a friendly halfling. Located in #[Ironhaven](location:xxx)...'"
          />

          <!-- Generate button -->
          <div class="flex items-center gap-3 mt-4">
            <button
              @click="generate"
              :disabled="generating || !freeformText.trim()"
              class="btn flex items-center gap-2"
            >
              <svg v-if="generating" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ generating ? 'Generating...' : '✨ Generate' }}
            </button>
            <span v-if="!freeformText.trim()" class="text-xs text-zinc-600">Write a description first</span>
          </div>

          <!-- Error -->
          <div v-if="genError" class="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p class="text-red-400 text-sm whitespace-pre-wrap">{{ genError }}</p>
          </div>
        </div>
      </div>

      <!-- Preview / Edit Generated Entity -->
      <div v-if="generatedEntity" class="card p-5 relative z-10">
        <div class="relative z-10 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-zinc-400" style="font-family: Manrope, sans-serif">🔍 Preview — Edit Before Saving</h3>
            <div class="flex gap-2">
              <button
                v-if="entityType !== 'session'"
                @click="generateEntityImage"
                :disabled="generatingImage"
                class="btn !text-xs !py-1.5 !bg-purple-500/15 !text-purple-400 hover:!bg-purple-500/25 flex items-center gap-1.5"
              >
                <svg v-if="generatingImage" class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ generatingImage ? 'Generating...' : '🎨 Generate Image' }}
              </button>
            </div>
          </div>

          <!-- Image error -->
          <div v-if="imageError" class="text-red-400 text-xs">{{ imageError }}</div>

          <!-- Generated image preview -->
          <div v-if="generatedEntity.imageUrl" class="overflow-hidden rounded-xl inline-block">
            <img :src="generatedEntity.imageUrl" class="max-w-xs max-h-48 object-contain rounded-xl" />
          </div>

          <!-- Validation warnings -->
          <div v-if="validationErrors.length > 0" class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p class="text-amber-400 text-sm font-semibold mb-1">⚠️ Validation Issues</p>
            <ul class="text-amber-400/80 text-xs space-y-0.5">
              <li v-for="(err, i) in validationErrors" :key="i">• {{ err }}</li>
            </ul>
          </div>

          <!-- NPC Preview -->
          <template v-if="entityType === 'npc'">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label text-xs mb-1 block">Name</label>
                <input v-model="generatedEntity.name" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Race</label>
                <input v-model="generatedEntity.race" class="input w-full" />
              </div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Description</label>
              <textarea v-model="generatedEntity.description" class="input w-full" rows="4" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">Location Encountered</label>
              <input v-model="generatedEntity.locationEncountered" class="input w-full" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">Tags</label>
              <TagInput v-model="generatedEntity.tags" />
            </div>
            <div v-if="generatedEntity.organizationIds?.length">
              <label class="label text-xs mb-1 block">Organization IDs</label>
              <div class="text-xs text-zinc-500">{{ generatedEntity.organizationIds.join(', ') }}</div>
            </div>
          </template>

          <!-- Session Preview -->
          <template v-else-if="entityType === 'session'">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="label text-xs mb-1 block">Session #</label>
                <input v-model.number="generatedEntity.sessionNumber" type="number" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Date</label>
                <input v-model="generatedEntity.date" type="date" class="input w-full" @click="($event.target as HTMLInputElement).showPicker?.()" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">DM</label>
                <input v-model="generatedEntity.dmName" class="input w-full" />
              </div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Title</label>
              <input v-model="generatedEntity.title" class="input w-full" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">Summary</label>
              <textarea v-model="generatedEntity.summary" class="input w-full" rows="6" />
            </div>
            <div v-if="generatedEntity.participants?.length">
              <label class="label text-xs mb-1 block">Participants</label>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="p in generatedEntity.participants" :key="p.characterId" class="badge bg-blue-500/15 text-blue-400">🧙 {{ p.characterName }}</span>
              </div>
            </div>
            <div v-if="generatedEntity.loot?.length">
              <label class="label text-xs mb-1 block">Loot</label>
              <div class="space-y-1">
                <div v-for="(l, i) in generatedEntity.loot" :key="i" class="text-xs text-zinc-400">
                  {{ l.quantity }}× {{ l.name }} → {{ l.recipient }}
                </div>
              </div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Tags</label>
              <TagInput v-model="generatedEntity.tags" />
            </div>
            <!-- Timeline preview -->
            <div v-if="generatedEntity.timeline?.length">
              <label class="label text-xs mb-2 block">Timeline ({{ generatedEntity.timeline.length }} entries)</label>
              <div class="space-y-2">
                <div
                  v-for="(entry, i) in generatedEntity.timeline"
                  :key="i"
                  class="card-flat p-3 flex gap-3"
                >
                  <div class="shrink-0 w-6 text-center">
                    <span class="text-xs font-bold text-zinc-500">{{ i + 1 }}</span>
                  </div>
                  <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span :class="[
                        'text-[0.65rem] px-1.5 py-0.5 rounded font-semibold leading-none',
                        entry.type === 'encounter' ? 'bg-red-500/15 text-red-400' :
                        entry.type === 'interaction' ? 'bg-blue-500/15 text-blue-400' :
                        entry.type === 'discovery' ? 'bg-amber-500/15 text-amber-400' :
                        entry.type === 'travel' ? 'bg-green-500/15 text-green-400' :
                        entry.type === 'task' ? 'bg-purple-500/15 text-purple-400' :
                        entry.type === 'rest' ? 'bg-cyan-500/15 text-cyan-400' :
                        'bg-zinc-500/15 text-zinc-400'
                      ]">
                        {{ entry.type === 'encounter' ? '⚔️' : entry.type === 'interaction' ? '💬' : entry.type === 'discovery' ? '🔍' : entry.type === 'travel' ? '🗺️' : entry.type === 'task' ? '📋' : entry.type === 'rest' ? '🏕️' : '📝' }}
                        {{ entry.type }}
                      </span>
                      <input v-model="entry.title" class="input !py-0.5 !px-1.5 !text-sm flex-1 min-w-0" />
                    </div>
                    <textarea v-model="entry.description" class="input w-full !text-xs !py-1 !px-1.5" rows="2" />
                  </div>
                  <button @click="generatedEntity!.timeline.splice(i, 1)" class="shrink-0 text-zinc-600 hover:text-red-400 transition-colors text-sm">✕</button>
                </div>
              </div>
            </div>
          </template>

          <!-- Location Preview -->
          <template v-else-if="entityType === 'location'">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label text-xs mb-1 block">Name</label>
                <input v-model="generatedEntity.name" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Type</label>
                <TypeSelect v-model="generatedEntity.type" :options="locationTypeOptions" input-class="w-full" />
              </div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Description</label>
              <textarea v-model="generatedEntity.description" class="input w-full" rows="4" />
            </div>
            <div>
              <label class="label text-xs mb-1 block">Tags</label>
              <TagInput v-model="generatedEntity.tags" />
            </div>
          </template>

          <!-- Feature Preview -->
          <template v-else-if="entityType === 'feature'">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label text-xs mb-1 block">Name</label>
                <input v-model="generatedEntity.name" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Type</label>
                <TypeSelect v-model="generatedEntity.type" :options="featureTypeOptions" input-class="w-full" />
              </div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Description</label>
              <textarea v-model="generatedEntity.description" class="input w-full" rows="4" />
            </div>
            <div v-if="generatedEntity.locationId">
              <label class="label text-xs mb-1 block">Parent Location</label>
              <div class="text-xs text-zinc-500">{{ locations.find(l => l.id === generatedEntity!.locationId)?.name || generatedEntity.locationId }}</div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Tags</label>
              <TagInput v-model="generatedEntity.tags" />
            </div>
          </template>

          <!-- Mission Preview -->
          <template v-else-if="entityType === 'mission'">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="label text-xs mb-1 block">Title</label>
                <input v-model="generatedEntity.title" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Tier</label>
                <input v-model.number="generatedEntity.tier" type="number" min="2" max="5" class="input w-full" />
              </div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Description</label>
              <textarea v-model="generatedEntity.description" class="input w-full" rows="4" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="label text-xs mb-1 block">Expected Duration (days)</label>
                <input v-model.number="generatedEntity.expectedDurationDays" type="number" min="0" class="input w-full" placeholder="Optional" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Mission Duration (days)</label>
                <input v-model.number="generatedEntity.missionDurationDays" type="number" min="0" class="input w-full" placeholder="Optional" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Duration Note</label>
                <input v-model="generatedEntity.durationNote" class="input w-full" placeholder="e.g. unknown" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="label text-xs mb-1 block">Pay Amount</label>
                <input v-model.number="generatedEntity.pay.amount" type="number" min="0" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Pay Type</label>
                <select v-model="generatedEntity.pay.type" class="input w-full">
                  <option value="each">Each</option>
                  <option value="total">Total</option>
                  <option value="per_day">Per Day</option>
                  <option value="performance">Performance</option>
                </select>
              </div>
              <div>
                <label class="label text-xs mb-1 block">Currency</label>
                <select v-model="generatedEntity.pay.currency" class="input w-full">
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                </select>
              </div>
            </div>
            <div>
              <label class="label text-xs mb-1 block">Pay Note</label>
              <input v-model="generatedEntity.pay.note" class="input w-full" placeholder="Optional clarification" />
            </div>
          </template>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
            <button
              @click="save"
              :disabled="saving || validationErrors.length > 0"
              class="btn flex items-center gap-2"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ saving ? 'Saving...' : '💾 Save to Firestore' }}
            </button>
            <button @click="generate" :disabled="generating" class="btn !bg-white/5 !text-zinc-400 text-sm">
              🔄 Regenerate
            </button>
            <button @click="generatedEntity = null" class="btn !bg-white/5 !text-zinc-400 text-sm">
              ✕ Discard
            </button>
          </div>

          <!-- Success message -->
          <div v-if="saveSuccess" class="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p class="text-green-400 text-sm font-semibold">✅ Entity saved successfully!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

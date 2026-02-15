import { ref, computed, watch } from 'vue'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { 
  Character, Npc, CampaignLocation, LocationFeature, 
  Organization, SessionLog, Mission, HexMarker, 
  NpcNote, SessionNote, HexNote, PartyInventoryItem 
} from '../types'

export type SearchResultType = 
  | 'character' | 'npc' | 'location' | 'feature' 
  | 'organization' | 'session' | 'mission' | 'marker' 
  | 'note' | 'inventory'

export interface SearchMatch {
  field: string
  value: string
  isTitle: boolean
  isTag: boolean
}

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  imageUrl?: string
  route: string
  matches: SearchMatch[]
  score: number
}

// Entity type config - using string index signature for template compatibility
const typeConfig: Record<string, { icon: string; label: string }> = {
  character: { icon: '⚔️', label: 'Character' },
  npc: { icon: '👤', label: 'NPC' },
  location: { icon: '🏰', label: 'Location' },
  feature: { icon: '📍', label: 'Point of Interest' },
  organization: { icon: '🏛️', label: 'Organization' },
  session: { icon: '📜', label: 'Session' },
  mission: { icon: '⚔️', label: 'Mission' },
  marker: { icon: '📌', label: 'Marker' },
  note: { icon: '📝', label: 'Note' },
  inventory: { icon: '🎒', label: 'Inventory' },
}

const MIN_SEARCH_LENGTH = 3
const DEBOUNCE_MS = 300

export function useSearch() {
  const auth = useAuthStore()
  
  // Raw data
  const characters = ref<Character[]>([])
  const npcs = ref<Npc[]>([])
  const locations = ref<CampaignLocation[]>([])
  const features = ref<LocationFeature[]>([])
  const organizations = ref<Organization[]>([])
  const sessions = ref<SessionLog[]>([])
  const missions = ref<Mission[]>([])
  const markers = ref<HexMarker[]>([])
  const npcNotes = ref<NpcNote[]>([])
  const sessionNotes = ref<SessionNote[]>([])
  const hexNotes = ref<HexNote[]>([])
  const inventory = ref<PartyInventoryItem[]>([])
  
  const searchQuery = ref('')
  const debouncedQuery = ref('')
  const isLoading = ref(true)
  const isInitialized = ref(false)
  
  // Debounce search query
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(searchQuery, (val) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedQuery.value = val
    }, DEBOUNCE_MS)
  })
  
  const unsubs: (() => void)[] = []
  
  function init() {
    if (isInitialized.value) return
    isInitialized.value = true
    
    // Helper to handle errors - still count as loaded so search doesn't hang
    const onError = (name: string) => (err: Error) => {
      console.warn(`Search: failed to load ${name}:`, err.message)
      checkLoading()
    }
    
    // Characters
    unsubs.push(onSnapshot(
      query(collection(db, 'characters'), orderBy('name')), 
      snap => {
        characters.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
        checkLoading()
      },
      onError('characters')
    ))
    
    // NPCs
    unsubs.push(onSnapshot(
      query(collection(db, 'npcs'), orderBy('name')), 
      snap => {
        npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
        checkLoading()
      },
      onError('npcs')
    ))
    
    // Locations
    unsubs.push(onSnapshot(
      query(collection(db, 'locations'), orderBy('name')), 
      snap => {
        locations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLocation))
        checkLoading()
      },
      onError('locations')
    ))
    
    // Features
    unsubs.push(onSnapshot(
      query(collection(db, 'features'), orderBy('name')), 
      snap => {
        features.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationFeature))
        checkLoading()
      },
      onError('features')
    ))
    
    // Organizations
    unsubs.push(onSnapshot(
      query(collection(db, 'organizations'), orderBy('name')), 
      snap => {
        organizations.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))
        checkLoading()
      },
      onError('organizations')
    ))
    
    // Sessions
    unsubs.push(onSnapshot(
      query(collection(db, 'sessions'), orderBy('sessionNumber', 'desc')), 
      snap => {
        sessions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionLog))
        checkLoading()
      },
      onError('sessions')
    ))
    
    // Missions
    unsubs.push(onSnapshot(
      query(collection(db, 'missions')), 
      snap => {
        missions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
        checkLoading()
      },
      onError('missions')
    ))
    
    // Markers (exclude hidden/private unless DM/admin)
    unsubs.push(onSnapshot(
      query(collection(db, 'markers')), 
      snap => {
        markers.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as HexMarker))
          .filter(m => {
            if (m.hidden && !auth.isDm && !auth.isAdmin) return false
            if (m.isPrivate && m.createdBy !== auth.firebaseUser?.uid && !auth.isDm && !auth.isAdmin) return false
            return true
          })
        checkLoading()
      },
      onError('markers')
    ))
    
    // NPC Notes (public only, or own notes)
    unsubs.push(onSnapshot(
      query(collection(db, 'npcNotes')), 
      snap => {
        npcNotes.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as NpcNote))
          .filter(n => !n.isPrivate || n.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin)
        checkLoading()
      },
      onError('npcNotes')
    ))
    
    // Session Notes (public only, or own notes)
    unsubs.push(onSnapshot(
      query(collection(db, 'sessionNotes')), 
      snap => {
        sessionNotes.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as SessionNote))
          .filter(n => !n.isPrivate || n.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin)
        checkLoading()
      },
      onError('sessionNotes')
    ))
    
    // Hex Notes (public only, or own notes)
    unsubs.push(onSnapshot(
      query(collection(db, 'hexNotes')), 
      snap => {
        hexNotes.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as HexNote))
          .filter(n => !n.isPrivate || n.userId === auth.firebaseUser?.uid || auth.isDm || auth.isAdmin)
        checkLoading()
      },
      onError('hexNotes')
    ))
    
    // Inventory
    unsubs.push(onSnapshot(
      query(collection(db, 'partyInventory')), 
      snap => {
        inventory.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as PartyInventoryItem))
        checkLoading()
      },
      onError('partyInventory')
    ))
  }
  
  let loadedCount = 0
  function checkLoading() {
    loadedCount++
    if (loadedCount >= 12) { // 12 collections
      isLoading.value = false
    }
  }
  
  function destroy() {
    unsubs.forEach(fn => fn())
    unsubs.length = 0
    isInitialized.value = false
    loadedCount = 0
    isLoading.value = true
  }
  
  // Search logic with scoring
  function searchText(text: string | undefined, query: string): boolean {
    if (!text) return false
    return text.toLowerCase().includes(query.toLowerCase())
  }
  
  function scoreMatch(matches: SearchMatch[]): number {
    let score = 0
    for (const m of matches) {
      if (m.isTitle) score += 100
      else if (m.isTag) score += 50
      else score += 10
    }
    return score
  }
  
  function findMatches(
    query: string,
    fields: { name: string; value: string | string[] | undefined; isTitle?: boolean; isTag?: boolean }[]
  ): SearchMatch[] {
    const q = query.toLowerCase()
    const matches: SearchMatch[] = []
    
    for (const field of fields) {
      if (Array.isArray(field.value)) {
        // Tags array
        for (const tag of field.value) {
          if (tag.toLowerCase().includes(q)) {
            matches.push({ field: field.name, value: tag, isTitle: false, isTag: true })
          }
        }
      } else if (field.value && searchText(field.value, q)) {
        matches.push({ 
          field: field.name, 
          value: field.value, 
          isTitle: field.isTitle || false, 
          isTag: false 
        })
      }
    }
    
    return matches
  }
  
  const results = computed<SearchResult[]>(() => {
    const q = debouncedQuery.value.trim()
    if (q.length < MIN_SEARCH_LENGTH) return []
    
    const allResults: SearchResult[] = []
    
    // Characters
    for (const c of characters.value) {
      const matches = findMatches(q, [
        { name: 'Name', value: c.name, isTitle: true },
        { name: 'Race', value: c.race },
        { name: 'Class', value: c.class },
        { name: 'Description', value: c.description },
        { name: 'Appearance', value: c.appearance },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: c.id,
          type: 'character',
          title: c.name,
          subtitle: `${c.race} ${c.class}`,
          imageUrl: c.imageUrl,
          route: `/characters/${c.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // NPCs
    for (const n of npcs.value) {
      const matches = findMatches(q, [
        { name: 'Name', value: n.name, isTitle: true },
        { name: 'Race', value: n.race },
        { name: 'Description', value: n.description },
        { name: 'Appearance', value: n.appearance },
        { name: 'Location', value: n.locationEncountered },
        { name: 'Tags', value: n.tags, isTag: true },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: n.id,
          type: 'npc',
          title: n.name,
          subtitle: n.race,
          imageUrl: n.imageUrl,
          route: `/npcs/${n.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Locations
    for (const loc of locations.value) {
      if (loc.hidden && !auth.isDm && !auth.isAdmin) continue
      const matches = findMatches(q, [
        { name: 'Name', value: loc.name, isTitle: true },
        { name: 'Type', value: loc.type },
        { name: 'Description', value: loc.description },
        { name: 'Tags', value: loc.tags, isTag: true },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: loc.id,
          type: 'location',
          title: loc.name,
          subtitle: loc.type,
          imageUrl: loc.imageUrl,
          route: `/locations/${loc.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Features
    for (const f of features.value) {
      if (f.hidden && !auth.isDm && !auth.isAdmin) continue
      const matches = findMatches(q, [
        { name: 'Name', value: f.name, isTitle: true },
        { name: 'Type', value: f.type },
        { name: 'Description', value: f.description },
        { name: 'Tags', value: f.tags, isTag: true },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: f.id,
          type: 'feature',
          title: f.name,
          subtitle: f.type,
          route: `/features/${f.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Organizations
    for (const o of organizations.value) {
      const matches = findMatches(q, [
        { name: 'Name', value: o.name, isTitle: true },
        { name: 'Description', value: o.description },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: o.id,
          type: 'organization',
          title: o.name,
          imageUrl: o.imageUrl,
          route: `/organizations/${o.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Sessions
    for (const s of sessions.value) {
      const matches = findMatches(q, [
        { name: 'Title', value: s.title, isTitle: true },
        { name: 'Summary', value: s.summary },
        { name: 'DM', value: s.dmName },
        { name: 'Location', value: s.sessionLocationName },
        { name: 'Starting Point', value: s.startingPointName },
        { name: 'Tags', value: s.tags, isTag: true },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: s.id,
          type: 'session',
          title: `#${s.sessionNumber}: ${s.title}`,
          subtitle: s.dmName ? `DM: ${s.dmName}` : undefined,
          route: `/sessions/${s.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Missions
    for (const m of missions.value) {
      const matches = findMatches(q, [
        { name: 'Title', value: m.title, isTitle: true },
        { name: 'Description', value: m.description },
        { name: 'Unit', value: m.unitName },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: m.id,
          type: 'mission',
          title: m.title,
          subtitle: `${m.unitName} • Tier ${m.tier}`,
          route: `/missions#${m.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Markers
    for (const m of markers.value) {
      const matches = findMatches(q, [
        { name: 'Name', value: m.name, isTitle: true },
        { name: 'Type', value: m.type },
        { name: 'Description', value: m.description },
        { name: 'Tags', value: m.tags, isTag: true },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: m.id,
          type: 'marker',
          title: m.name,
          subtitle: m.type,
          route: `/map?marker=${m.id}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // NPC Notes
    for (const n of npcNotes.value) {
      if (n.deleted) continue
      const matches = findMatches(q, [
        { name: 'Content', value: n.content },
      ])
      if (matches.length > 0) {
        const npc = npcs.value.find(x => x.id === n.npcId)
        allResults.push({
          id: n.id,
          type: 'note',
          title: `Note on ${npc?.name || 'NPC'}`,
          subtitle: `by ${n.authorName}`,
          route: `/npcs/${n.npcId}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Session Notes
    for (const n of sessionNotes.value) {
      if (n.deleted) continue
      const matches = findMatches(q, [
        { name: 'Content', value: n.content },
      ])
      if (matches.length > 0) {
        const session = sessions.value.find(x => x.id === n.sessionId)
        allResults.push({
          id: n.id,
          type: 'note',
          title: `Note on Session ${session?.sessionNumber || '?'}`,
          subtitle: `by ${n.authorName}`,
          route: `/sessions/${n.sessionId}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Hex Notes
    for (const n of hexNotes.value) {
      const matches = findMatches(q, [
        { name: 'Content', value: n.content },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: n.id,
          type: 'note',
          title: `Map Note`,
          subtitle: `by ${n.authorName}`,
          route: `/map?hex=${n.hexKey}`,
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Inventory
    for (const item of inventory.value) {
      const matches = findMatches(q, [
        { name: 'Name', value: item.name, isTitle: true },
        { name: 'Description', value: item.description },
      ])
      if (matches.length > 0) {
        allResults.push({
          id: item.id,
          type: 'inventory',
          title: item.name,
          subtitle: item.quantity > 1 ? `×${item.quantity}` : undefined,
          route: '/inventory',
          matches,
          score: scoreMatch(matches),
        })
      }
    }
    
    // Sort by score (highest first), then alphabetically
    return allResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.title.localeCompare(b.title)
    })
  })
  
  // Group results by type for display
  const groupedResults = computed(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const r of results.value) {
      if (!groups[r.type]) groups[r.type] = []
      groups[r.type]!.push(r)
    }
    return groups
  })
  
  return {
    searchQuery,
    results,
    groupedResults,
    isLoading,
    typeConfig,
    init,
    destroy,
  }
}

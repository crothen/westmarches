export type UserRole = 'player' | 'dm' | 'admin' | 'guest'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  roles: UserRole[]
  /** @deprecated Use `roles` array instead. Kept for backward compat during migration. */
  role?: UserRole
  characterId?: string
  discordUsername?: string
  createdAt: Date
}

export interface NoteReply {
  id: string
  userId: string
  authorName: string
  content: string
  deleted?: boolean
  createdAt: Date
}

export interface NpcNote {
  id: string
  npcId: string
  userId: string
  authorName: string
  content: string
  isPrivate: boolean
  deleted?: boolean
  replies: NoteReply[]
  createdAt: Date
  updatedAt: Date
}

export interface Character {
  id: string
  userId?: string  // assigned user (set by admin/DM)
  name: string
  race: string
  class: string
  level: number
  description: string
  appearance?: string  // visual description for consistent AI image gen (max 200 chars)
  imageUrl?: string
  galleryUrls?: string[]  // additional images, first = hero portrait
  characterUrl?: string  // external character sheet URL (e.g. D&D Beyond)
  isActive: boolean
  downtimeDaysUsed?: number  // downtime days the player has spent
  createdAt: Date
  updatedAt: Date
}

export interface Location {
  id: string
  name: string
  description: string
  hexCoords?: { q: number; r: number }
  tags: string[]
  discoveredBy: string
  discoveredAt: Date
  comments: Comment[]
}

export interface HexTag {
  id: string
  hexQ: number
  hexR: number
  label: string
  description?: string
  color?: string
  addedBy: string
  addedAt: Date
  isPublic: boolean
}

export interface Comment {
  id: string
  authorId: string
  authorName: string
  content: string
  isPrivate: boolean
  targetType: 'location' | 'character' | 'npc' | 'organization' | 'hex'
  targetId: string
  createdAt: Date
}

export interface PartyInventoryItem {
  id: string
  name: string
  description?: string
  quantity: number
  addedBy: string
  addedAt: Date
}

export interface Npc {
  id: string
  name: string
  race?: string
  description: string
  appearance?: string  // visual description for consistent AI image gen (max 200 chars)
  locationEncountered?: string
  hexCoords?: { q: number; r: number }
  tags: string[]
  organizationIds: string[]
  imageUrl?: string
  createdAt: Date
  updatedAt: Date
}

export type OrgRank = 'leader' | 'subleader' | 'officer' | 'underofficer' | 'member' | 'initiate'

export interface OrgMember {
  entityType: 'player' | 'npc'
  entityId: string
  name: string
  rank: OrgRank
}

export interface Organization {
  id: string
  name: string
  description: string
  imageUrl?: string
  members: OrgMember[]
  createdAt: Date
  updatedAt: Date
}

export interface Vote {
  id: string
  targetType: string
  targetId: string
  userId: string
  value: 1 | -1
  createdAt: Date
}

export interface Like {
  id: string
  targetType: string
  targetId: string
  userId: string
  createdAt: Date
}

export interface SessionLog {
  id: string
  sessionNumber: number
  title: string
  date: Date
  inGameStartDate?: string  // in-game date (YYYY-MM-DD format)
  inGameDurationDays?: number  // how many in-game days the session spans
  summary: string
  dmId?: string
  dmName?: string
  sessionLocationId?: string
  sessionLocationName?: string
  startingPointType?: 'location' | 'feature'
  startingPointId?: string
  startingPointName?: string
  participants: SessionParticipant[]
  locationsVisited: string[]  // location IDs
  npcsEncountered: string[]   // npc IDs
  loot: LootEntry[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface SessionParticipant {
  userId: string
  characterId: string
  characterName: string
}

export interface LootEntry {
  name: string
  description?: string
  quantity: number
  recipient?: string  // character name or "party"
}

export interface SessionNote {
  id: string
  sessionId: string
  userId: string
  authorName: string
  content: string
  isPrivate: boolean
  deleted?: boolean
  replies: NoteReply[]
  createdAt: Date
  updatedAt: Date
}

export type MissionStatus = 'available' | 'in_progress' | 'completed' | 'failed' | 'unavailable'

export interface MissionVoteEntry {
  userId: string
  userName: string
}

export interface Mission {
  id: string
  unitId: string  // organization/unit this belongs to
  unitName: string
  title: string
  description: string
  tier: number
  expectedDurationDays?: number
  missionDurationDays?: number
  durationNote?: string  // for "unknown, up to 1 month" etc
  pay: {
    amount: number
    type: 'each' | 'total' | 'per_day' | 'performance'
    currency: 'silver' | 'gold'
    note?: string  // for "most likely more than 50 gold each" etc
  }
  votes?: MissionVoteEntry[]
  suggested?: boolean
  status: MissionStatus
  createdAt: Date
  updatedAt: Date
}

export interface ScheduledSession {
  id: string
  date: Date
  title?: string
  description?: string
  maxPlayers?: number
  sessionLocationKey?: string
  sessionLocationLabel?: string
  signups: SessionSignup[]
  missionVotes: MissionVote[]
  selectedMissionId?: string
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

export interface SessionSignup {
  userId: string
  characterId?: string
  characterName: string
  signedUpAt: Date
}

export interface MissionVote {
  userId: string
  missionId: string
  votedAt: Date
}

export interface HexNote {
  id: string
  hexKey: string  // "x_y" format
  userId: string
  authorName: string
  content: string
  isPrivate: boolean  // private = only author and DM
  replies: HexNoteReply[]
  createdAt: Date
  updatedAt: Date
}

export interface HexNoteReply {
  id: string
  userId: string
  authorName: string
  content: string
  deleted?: boolean
  createdAt: Date
}

export type LocationType = 'city' | 'town' | 'village' | 'castle' | 'fortress' | 'monastery' | 'camp' | 'ruins' | 'other'

export interface CampaignLocation {
  id: string
  name: string
  type: LocationType
  description: string
  hexKey?: string  // "x_y" format — which hex on the overworld
  mapImageUrl?: string  // city/town map image
  imageUrl?: string  // AI generated or uploaded image
  discoveredBy?: string
  hidden?: boolean  // if true, only DM/Admin can see it
  parentLocationId?: string  // nested location — e.g. dungeon inside a city
  mapPosition?: { x: number; y: number }  // position on parent's map (percentage-based)
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export type FeatureType = 'inn' | 'shop' | 'temple' | 'shrine' | 'blacksmith' | 'tavern' | 'guild' | 'market' | 'gate' | 'tower' | 'ruins' | 'cave' | 'bridge' | 'well' | 'monument' | 'graveyard' | 'dock' | 'warehouse' | 'barracks' | 'library' | 'other'

export interface LocationFeature {
  id: string
  name: string
  type: FeatureType
  description: string
  locationId?: string  // parent location (city/town) — null if standalone on hex
  hexKey?: string  // overworld hex — for standalone features OR inherited from parent
  // Position on the location's map image (percentage-based for responsiveness)
  mapPosition?: { x: number; y: number }
  discoveredBy?: string
  hidden?: boolean  // if true, only DM/Admin can see it
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// --- Markers (Feature 2) ---

// --- Session Timeline Entries ---

export type SessionEntryType = 'interaction' | 'task' | 'encounter' | 'discovery' | 'travel' | 'rest' | 'custom'

export interface SessionEntry {
  id: string
  sessionId: string
  order: number
  type: SessionEntryType
  title: string
  description: string
  presentParticipants?: SessionParticipant[]
  allParticipantsPresent?: boolean
  npcIds?: string[]
  linkedLocationIds?: string[]
  linkedFeatureIds?: string[]
  linkedMarkerIds?: string[]
  imageUrl?: string
  attachments?: { name: string; url: string; type: string }[]
  comments?: EntryComment[]
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface EntryComment {
  id: string
  userId: string
  authorName: string
  content: string
  createdAt: Date
}

export type MarkerType = 'clue' | 'battle' | 'danger' | 'puzzle' | 'mystery' | 'waypoint' | 'quest' | 'locked' | 'unlocked'

export interface HexMarker {
  id: string
  type: MarkerType
  name: string
  description: string
  hexKey?: string  // overworld position
  locationId?: string  // parent location (for city/dungeon maps)
  mapPosition?: { x: number; y: number }  // position on location map
  hidden?: boolean
  isPrivate?: boolean  // private = only creator and admins can see
  createdBy?: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

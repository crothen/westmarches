export type UserRole = 'player' | 'dm' | 'admin'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  characterId?: string
  createdAt: Date
}

export interface Character {
  id: string
  userId: string
  name: string
  race: string
  class: string
  level: number
  description: string
  imageUrl?: string
  isActive: boolean
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
  locationEncountered?: string
  hexCoords?: { q: number; r: number }
  tags: string[]
  organizationIds: string[]
  createdAt: Date
  updatedAt: Date
}

export type OrgRank = 'leader' | 'subleader' | 'officer' | 'underofficer' | 'member'

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
  summary: string
  dmId?: string
  dmName?: string
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
  isPrivate: boolean  // private = only visible to author and DMs
  createdAt: Date
  updatedAt: Date
}

export type MissionStatus = 'available' | 'in_progress' | 'completed' | 'failed'

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
  createdAt: Date
}

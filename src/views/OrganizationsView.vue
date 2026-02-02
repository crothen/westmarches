<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import NpcLink from '../components/common/NpcLink.vue'
import type { Organization, OrgMember, OrgRank, Npc } from '../types'

const auth = useAuthStore()

const orgs = ref<Organization[]>([])
const npcs = ref<Npc[]>([])
const loading = ref(true)
const expandedOrg = ref<string | null>(null)
const searchQuery = ref('')

// Create/Edit form state
const showForm = ref(false)
const editingOrg = ref<string | null>(null)
const form = ref({ name: '', description: '' })
const saving = ref(false)

// Add member state
const addingMemberOrg = ref<string | null>(null)
const memberSearch = ref('')
const selectedMemberType = ref<'npc' | 'player'>('npc')
const selectedRank = ref<OrgRank>('member')

const RANK_ORDER: Record<OrgRank, number> = { leader: 0, subleader: 1, officer: 2, underofficer: 3, member: 4 }
const RANK_LABELS: Record<OrgRank, string> = { leader: 'Leader', subleader: 'Vice-Leader', officer: 'Officer', underofficer: 'Under-Officer', member: 'Member' }
const ALL_RANKS: OrgRank[] = ['leader', 'subleader', 'officer', 'underofficer', 'member']

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    orgs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))
    loading.value = false
  }, (e) => {
    console.error('Failed to load organizations:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name', 'asc')), (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }, (e) => console.error('Failed to load NPCs:', e)))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const filteredOrgs = computed(() => {
  if (!searchQuery.value) return orgs.value
  const q = searchQuery.value.toLowerCase()
  return orgs.value.filter(o =>
    o.name.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)
  )
})

function getNpcById(id: string): Npc | undefined {
  return npcs.value.find(n => n.id === id)
}

function sortedMembers(members: OrgMember[]): OrgMember[] {
  return [...members].sort((a, b) => (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99))
}

function getRankBadgeClass(rank: OrgRank): string {
  switch (rank) {
    case 'leader': return 'bg-[#ef233c]/15 text-[#ef233c]'
    case 'subleader': return 'bg-orange-500/15 text-orange-400'
    case 'officer': return 'bg-blue-500/15 text-blue-400'
    case 'underofficer': return 'bg-teal-500/15 text-teal-400'
    default: return 'bg-white/5 text-zinc-500'
  }
}

const canManage = computed(() => auth.isDm || auth.isAdmin)

// --- Create / Edit ---
function startCreate() {
  editingOrg.value = null
  form.value = { name: '', description: '' }
  showForm.value = true
}

function startEdit(org: Organization) {
  editingOrg.value = org.id
  form.value = { name: org.name, description: org.description || '' }
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingOrg.value = null
}

async function saveOrg() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    if (editingOrg.value) {
      await updateDoc(doc(db, 'organizations', editingOrg.value), {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        updatedAt: new Date(),
      })
      const org = orgs.value.find(o => o.id === editingOrg.value)
      if (org) {
        org.name = form.value.name.trim()
        org.description = form.value.description.trim()
      }
    } else {
      const newOrg = {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const docRef = await addDoc(collection(db, 'organizations'), newOrg)
      orgs.value.push({ id: docRef.id, ...newOrg } as Organization)
      orgs.value.sort((a, b) => a.name.localeCompare(b.name))
    }
    showForm.value = false
    editingOrg.value = null
  } catch (e) {
    console.error('Failed to save organization:', e)
    alert('Failed to save. Check permissions.')
  } finally {
    saving.value = false
  }
}

async function deleteOrg(org: Organization) {
  if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return
  try {
    await deleteDoc(doc(db, 'organizations', org.id))
    orgs.value = orgs.value.filter(o => o.id !== org.id)
    // Clean up NPC organizationIds references
    for (const npc of npcs.value) {
      if ((npc.organizationIds || []).includes(org.id)) {
        const newIds = npc.organizationIds.filter(id => id !== org.id)
        await updateDoc(doc(db, 'npcs', npc.id), { organizationIds: newIds })
        npc.organizationIds = newIds
      }
    }
  } catch (e) {
    console.error('Failed to delete organization:', e)
  }
}

// --- Members ---
function startAddMember(orgId: string) {
  addingMemberOrg.value = orgId
  memberSearch.value = ''
  selectedRank.value = 'member'
  selectedMemberType.value = 'npc'
}

const filteredNpcsForAdd = computed(() => {
  if (!addingMemberOrg.value) return []
  const org = orgs.value.find(o => o.id === addingMemberOrg.value)
  if (!org) return []
  const existingIds = new Set((org.members || []).filter(m => m.entityType === 'npc').map(m => m.entityId))
  let candidates = npcs.value.filter(n => !existingIds.has(n.id))
  if (memberSearch.value) {
    const q = memberSearch.value.toLowerCase()
    candidates = candidates.filter(n => n.name.toLowerCase().includes(q))
  }
  return candidates.slice(0, 10)
})

async function addMember(orgId: string, npc: Npc) {
  const org = orgs.value.find(o => o.id === orgId)
  if (!org) return

  const newMember: OrgMember = {
    entityType: 'npc',
    entityId: npc.id,
    name: npc.name,
    rank: selectedRank.value,
  }

  const members = [...(org.members || []), newMember]
  try {
    await updateDoc(doc(db, 'organizations', orgId), { members, updatedAt: new Date() })
    org.members = members
    // Also update NPC's organizationIds
    const npcOrgIds = [...(npc.organizationIds || []), orgId]
    await updateDoc(doc(db, 'npcs', npc.id), { organizationIds: npcOrgIds })
    npc.organizationIds = npcOrgIds
  } catch (e) {
    console.error('Failed to add member:', e)
  }
}

async function removeMember(orgId: string, member: OrgMember) {
  const org = orgs.value.find(o => o.id === orgId)
  if (!org) return

  const members = (org.members || []).filter(m => !(m.entityType === member.entityType && m.entityId === member.entityId))
  try {
    await updateDoc(doc(db, 'organizations', orgId), { members, updatedAt: new Date() })
    org.members = members
    // Also update NPC's organizationIds
    if (member.entityType === 'npc') {
      const npc = npcs.value.find(n => n.id === member.entityId)
      if (npc) {
        const npcOrgIds = (npc.organizationIds || []).filter(id => id !== orgId)
        await updateDoc(doc(db, 'npcs', npc.id), { organizationIds: npcOrgIds })
        npc.organizationIds = npcOrgIds
      }
    }
  } catch (e) {
    console.error('Failed to remove member:', e)
  }
}

async function changeMemberRank(orgId: string, member: OrgMember, newRank: OrgRank) {
  const org = orgs.value.find(o => o.id === orgId)
  if (!org) return

  const members = (org.members || []).map(m => {
    if (m.entityType === member.entityType && m.entityId === member.entityId) {
      return { ...m, rank: newRank }
    }
    return m
  })

  try {
    await updateDoc(doc(db, 'organizations', orgId), { members, updatedAt: new Date() })
    org.members = members
  } catch (e) {
    console.error('Failed to change rank:', e)
  }
}

function toggleExpand(id: string) {
  expandedOrg.value = expandedOrg.value === id ? null : id
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">🏛️ Organizations</h1>
      <div class="flex items-center gap-3">
        <span class="text-zinc-600 text-sm">{{ filteredOrgs.length }} organizations</span>
        <button v-if="canManage" @click="startCreate" class="btn text-sm">+ New</button>
      </div>
    </div>

    <!-- Search -->
    <input v-model="searchQuery" type="text" placeholder="Search organizations..." class="input w-full max-w-md mb-6" />

    <!-- Create/Edit Form -->
    <div v-if="showForm" class="card relative z-10 p-5 mb-6">
      <div class="relative z-10 space-y-3">
        <h3 class="text-sm font-semibold text-zinc-300" style="font-family: Manrope, sans-serif">
          {{ editingOrg ? 'Edit Organization' : 'New Organization' }}
        </h3>
        <input v-model="form.name" class="input w-full" placeholder="Organization name" />
        <textarea v-model="form.description" class="input w-full" rows="3" placeholder="Description..." />
        <div class="flex gap-2">
          <button @click="saveOrg" :disabled="saving || !form.name.trim()" class="btn text-sm">
            {{ saving ? 'Saving...' : (editingOrg ? 'Save' : 'Create') }}
          </button>
          <button @click="cancelForm" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading organizations...</div>

    <div v-else-if="filteredOrgs.length === 0 && !showForm" class="card p-10 text-center relative z-10">
      <div class="relative z-10">
        <p class="text-zinc-600">No organizations yet.</p>
        <button v-if="canManage" @click="startCreate" class="btn text-sm mt-3">Create the first one</button>
      </div>
    </div>

    <!-- Org cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="org in filteredOrgs" :key="org.id"
        class="card relative z-10 cursor-pointer"
        @click="toggleExpand(org.id)"
      >
        <div class="relative z-10 p-5">
          <!-- Header -->
          <div class="flex items-start justify-between mb-2">
            <div>
              <h3 class="text-base font-semibold text-white" style="font-family: Manrope, sans-serif">{{ org.name }}</h3>
              <span class="text-zinc-600 text-xs">{{ (org.members || []).length }} members</span>
            </div>
            <div class="flex items-center gap-2" v-if="canManage" @click.stop>
              <button @click="startEdit(org)" class="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">✏️</button>
              <button @click="deleteOrg(org)" class="text-zinc-600 hover:text-red-400 text-xs transition-colors">🗑️</button>
            </div>
          </div>

          <!-- Description -->
          <p :class="['text-sm', expandedOrg === org.id ? 'text-zinc-300' : 'text-zinc-500 line-clamp-2']">
            {{ org.description }}
          </p>

          <!-- Member preview (collapsed) -->
          <div v-if="expandedOrg !== org.id && (org.members || []).length > 0" class="flex flex-wrap gap-1.5 mt-3">
            <template v-for="member in sortedMembers(org.members || []).slice(0, 5)" :key="member.entityId">
              <span class="text-[0.65rem] px-2 py-0.5 rounded-full" :class="getRankBadgeClass(member.rank)">
                {{ member.name }}
              </span>
            </template>
            <span v-if="(org.members || []).length > 5" class="text-[0.65rem] text-zinc-600">
              +{{ (org.members || []).length - 5 }} more
            </span>
          </div>

          <!-- Expanded: full member list -->
          <div v-if="expandedOrg === org.id" class="mt-4 pt-3 border-t border-white/[0.06]">
            <h4 class="label text-xs mb-3">Members</h4>

            <div v-if="(org.members || []).length === 0" class="text-zinc-600 text-sm">No members yet.</div>

            <div class="space-y-1.5">
              <div
                v-for="member in sortedMembers(org.members || [])" :key="member.entityId"
                class="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                @click.stop
              >
                <div class="flex items-center gap-2.5">
                  <!-- NPC portrait thumbnail -->
                  <template v-if="member.entityType === 'npc'">
                    <img
                      v-if="getNpcById(member.entityId)?.imageUrl"
                      :src="getNpcById(member.entityId)!.imageUrl"
                      class="w-7 h-7 rounded-full object-cover"
                    />
                    <div v-else class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 text-xs">👤</div>
                  </template>
                  <div v-else class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 text-xs">🧙</div>

                  <NpcLink
                    v-if="member.entityType === 'npc'"
                    :npcId="member.entityId"
                    :name="member.name"
                  />
                  <span v-else class="text-sm text-zinc-200">{{ member.name }}</span>

                  <span class="text-[0.6rem] px-2 py-0.5 rounded-full" :class="getRankBadgeClass(member.rank)">
                    {{ RANK_LABELS[member.rank] }}
                  </span>
                </div>

                <div v-if="canManage" class="flex items-center gap-2">
                  <select
                    :value="member.rank"
                    @change="(e: any) => changeMemberRank(org.id, member, e.target.value)"
                    class="input !py-0.5 !px-2 !text-[0.65rem] !w-auto"
                    @click.stop
                  >
                    <option v-for="r in ALL_RANKS" :key="r" :value="r">{{ RANK_LABELS[r] }}</option>
                  </select>
                  <button
                    @click.stop="removeMember(org.id, member)"
                    class="text-zinc-700 hover:text-red-400 text-xs transition-colors"
                  >✕</button>
                </div>
              </div>
            </div>

            <!-- Add member -->
            <div v-if="canManage" class="mt-3 pt-3 border-t border-white/[0.06]" @click.stop>
              <div v-if="addingMemberOrg === org.id" class="space-y-2">
                <div class="flex gap-2">
                  <input
                    v-model="memberSearch"
                    class="input flex-1 !text-sm"
                    placeholder="Search NPCs to add..."
                  />
                  <select v-model="selectedRank" class="input !text-xs !w-auto">
                    <option v-for="r in ALL_RANKS" :key="r" :value="r">{{ RANK_LABELS[r] }}</option>
                  </select>
                </div>
                <div v-if="filteredNpcsForAdd.length > 0" class="space-y-1 max-h-40 overflow-y-auto">
                  <button
                    v-for="npc in filteredNpcsForAdd" :key="npc.id"
                    @click="addMember(org.id, npc)"
                    class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <img v-if="npc.imageUrl" :src="npc.imageUrl" class="w-6 h-6 rounded-full object-cover" />
                    <div v-else class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 text-[0.6rem]">👤</div>
                    <span class="text-sm text-zinc-300">{{ npc.name }}</span>
                    <span class="text-[0.6rem] text-zinc-600">{{ npc.race }}</span>
                  </button>
                </div>
                <div v-else-if="memberSearch" class="text-zinc-600 text-xs px-1">No matching NPCs found.</div>
                <button @click="addingMemberOrg = null" class="text-xs text-zinc-600 hover:text-zinc-400">Close</button>
              </div>
              <button v-else @click="startAddMember(org.id)" class="btn !text-[0.65rem] !py-1.5 !px-3 !bg-white/5 !text-zinc-400">
                + Add Member
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

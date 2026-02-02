<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, collection, query, orderBy, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import NpcLink from '../components/common/NpcLink.vue'
import type { Organization, OrgMember, OrgRank, Npc, Character } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { generating: generatingSigil, error: genError, generateImage } = useImageGen()

const org = ref<Organization | null>(null)
const npcs = ref<Npc[]>([])
const characters = ref<Character[]>([])
const loading = ref(true)

// Edit org state
const showEditModal = ref(false)
const editForm = ref({ name: '', description: '' })
const savingEdit = ref(false)

// Sigil state
const sigilPrompt = ref('')
const showSigilSection = ref(false)
const uploadingSigil = ref(false)
const uploadProgress = ref(0)
const showImageOverlay = ref(false)

// Add member state
const showAddMember = ref(false)
const memberSearch = ref('')
const memberEntityTab = ref<'npc' | 'character'>('npc')
const selectedRank = ref<OrgRank>('member')

// Rank constants
const RANK_LABELS: Record<OrgRank, string> = { leader: 'Leader', subleader: 'Vice-Leader', officer: 'Officer', underofficer: 'Under-Officer', member: 'Member', initiate: 'Initiate' }
const ALL_RANKS: OrgRank[] = ['leader', 'subleader', 'officer', 'underofficer', 'member', 'initiate']

const orgId = computed(() => route.params.id as string)
const canManage = computed(() => auth.isDm || auth.isAdmin)

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(doc(db, 'organizations', orgId.value), (snap) => {
    if (snap.exists()) {
      org.value = { id: snap.id, ...snap.data() } as Organization
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load organization:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'npcs'), orderBy('name', 'asc')), (snap) => {
    npcs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Npc))
  }, (e) => console.error('Failed to load NPCs:', e)))

  _unsubs.push(onSnapshot(query(collection(db, 'characters'), orderBy('name', 'asc')), (snap) => {
    characters.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Character))
  }, (e) => console.error('Failed to load characters:', e)))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

// --- Helpers ---

function getNpcById(id: string): Npc | undefined {
  return npcs.value.find(n => n.id === id)
}

function getCharacterById(id: string): Character | undefined {
  return characters.value.find(c => c.id === id)
}

function getMemberImageUrl(member: OrgMember): string | undefined {
  if (member.entityType === 'npc') return getNpcById(member.entityId)?.imageUrl
  return getCharacterById(member.entityId)?.imageUrl
}

function getRankBadgeClass(rank: OrgRank): string {
  switch (rank) {
    case 'leader': return 'bg-[#ef233c]/15 text-[#ef233c]'
    case 'subleader': return 'bg-orange-500/15 text-orange-400'
    case 'officer': return 'bg-blue-500/15 text-blue-400'
    case 'underofficer': return 'bg-teal-500/15 text-teal-400'
    case 'initiate': return 'bg-zinc-500/15 text-zinc-400'
    default: return 'bg-white/5 text-zinc-500'
  }
}

function getRankIcon(rank: OrgRank): string {
  switch (rank) {
    case 'leader': return '👑'
    case 'subleader': return '⚜️'
    case 'officer': return '🛡️'
    case 'underofficer': return '⚔️'
    case 'member': return '👤'
    case 'initiate': return '🌱'
    default: return '👤'
  }
}

/** Group members by rank, only include ranks that have members */
const membersByRank = computed(() => {
  if (!org.value?.members?.length) return []
  const groups: { rank: OrgRank; label: string; icon: string; members: OrgMember[] }[] = []
  for (const rank of ALL_RANKS) {
    const members = (org.value.members || []).filter(m => m.rank === rank)
    if (members.length > 0) {
      groups.push({ rank, label: RANK_LABELS[rank], icon: getRankIcon(rank), members })
    }
  }
  return groups
})

function getDefaultSigilPrompt(): string {
  if (!org.value) return ''
  return `Heraldic sigil/coat of arms for a fantasy organization called '${org.value.name}'. ${org.value.description || ''}. Style: medieval heraldry, clean design, dark background, symbolic imagery.`
}

// --- Edit org ---

function openEditModal() {
  if (!org.value) return
  editForm.value = { name: org.value.name, description: org.value.description || '' }
  showEditModal.value = true
}

async function saveEdit() {
  if (!org.value || !editForm.value.name.trim()) return
  savingEdit.value = true
  try {
    await updateDoc(doc(db, 'organizations', org.value.id), {
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim(),
      updatedAt: new Date(),
    })
    showEditModal.value = false
  } catch (e) {
    console.error('Failed to save organization:', e)
    alert('Failed to save. Check permissions.')
  } finally {
    savingEdit.value = false
  }
}

// --- Sigil ---

function openSigilSection() {
  sigilPrompt.value = getDefaultSigilPrompt()
  showSigilSection.value = true
}

async function generateSigil() {
  if (!org.value) return
  const url = await generateImage(sigilPrompt.value, `org-sigils/${org.value.id}`)
  if (url) {
    await updateDoc(doc(db, 'organizations', org.value.id), { imageUrl: url, updatedAt: new Date() })
  }
}

async function uploadSigil(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !org.value) return
  uploadingSigil.value = true
  uploadProgress.value = 0
  const timestamp = Date.now()
  const ext = file.name.split('.').pop() || 'png'
  const fileRef = storageRef(storage, `org-sigils/${org.value.id}/${timestamp}.${ext}`)
  const uploadTask = uploadBytesResumable(fileRef, file)

  uploadTask.on('state_changed',
    (snapshot) => { uploadProgress.value = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) },
    (error) => { console.error('Upload failed:', error); uploadingSigil.value = false; alert('Upload failed.') },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      await updateDoc(doc(db, 'organizations', org.value!.id), { imageUrl: url, updatedAt: new Date() })
      uploadingSigil.value = false
      uploadProgress.value = 0
    }
  )
}

async function deleteSigil() {
  if (!org.value || !confirm('Delete the sigil image?')) return
  try {
    await updateDoc(doc(db, 'organizations', org.value.id), { imageUrl: '', updatedAt: new Date() })
  } catch (e) {
    console.error('Failed to delete sigil:', e)
    alert('Failed to delete sigil.')
  }
}

// --- Members ---

const filteredNpcsForAdd = computed(() => {
  if (!org.value) return []
  const existingIds = new Set((org.value.members || []).filter(m => m.entityType === 'npc').map(m => m.entityId))
  let candidates = npcs.value.filter(n => !existingIds.has(n.id))
  if (memberSearch.value) {
    const q = memberSearch.value.toLowerCase()
    candidates = candidates.filter(n => n.name.toLowerCase().includes(q))
  }
  return candidates.slice(0, 15)
})

const filteredCharsForAdd = computed(() => {
  if (!org.value) return []
  const existingIds = new Set((org.value.members || []).filter(m => m.entityType === 'player').map(m => m.entityId))
  let candidates = characters.value.filter(c => !existingIds.has(c.id))
  if (memberSearch.value) {
    const q = memberSearch.value.toLowerCase()
    candidates = candidates.filter(c => c.name.toLowerCase().includes(q))
  }
  return candidates.slice(0, 15)
})

async function addNpcMember(npc: Npc) {
  if (!org.value) return
  const newMember: OrgMember = {
    entityType: 'npc',
    entityId: npc.id,
    name: npc.name,
    rank: selectedRank.value,
  }
  const members = [...(org.value.members || []), newMember]
  try {
    await updateDoc(doc(db, 'organizations', org.value.id), { members, updatedAt: new Date() })
    // Also update NPC's organizationIds
    const npcOrgIds = [...(npc.organizationIds || []), org.value.id]
    await updateDoc(doc(db, 'npcs', npc.id), { organizationIds: npcOrgIds })
    npc.organizationIds = npcOrgIds
  } catch (e) {
    console.error('Failed to add member:', e)
  }
}

async function addCharacterMember(character: Character) {
  if (!org.value) return
  const newMember: OrgMember = {
    entityType: 'player',
    entityId: character.id,
    name: character.name,
    rank: selectedRank.value,
  }
  const members = [...(org.value.members || []), newMember]
  try {
    await updateDoc(doc(db, 'organizations', org.value.id), { members, updatedAt: new Date() })
  } catch (e) {
    console.error('Failed to add character member:', e)
  }
}

async function removeMember(member: OrgMember) {
  if (!org.value) return
  if (!confirm(`Remove ${member.name} from this organization?`)) return
  const members = (org.value.members || []).filter(m => !(m.entityType === member.entityType && m.entityId === member.entityId))
  try {
    await updateDoc(doc(db, 'organizations', org.value.id), { members, updatedAt: new Date() })
    if (member.entityType === 'npc') {
      const npc = npcs.value.find(n => n.id === member.entityId)
      if (npc) {
        const npcOrgIds = (npc.organizationIds || []).filter(id => id !== org.value!.id)
        await updateDoc(doc(db, 'npcs', npc.id), { organizationIds: npcOrgIds })
        npc.organizationIds = npcOrgIds
      }
    }
  } catch (e) {
    console.error('Failed to remove member:', e)
  }
}

async function changeMemberRank(member: OrgMember, newRank: OrgRank) {
  if (!org.value) return
  const members = (org.value.members || []).map(m => {
    if (m.entityType === member.entityType && m.entityId === member.entityId) {
      return { ...m, rank: newRank }
    }
    return m
  })
  try {
    await updateDoc(doc(db, 'organizations', org.value.id), { members, updatedAt: new Date() })
  } catch (e) {
    console.error('Failed to change rank:', e)
  }
}

// --- Delete org ---

async function deleteOrg() {
  if (!org.value) return
  if (!confirm(`Delete "${org.value.name}"? This cannot be undone.`)) return
  try {
    // Clean up NPC references
    for (const member of org.value.members || []) {
      if (member.entityType === 'npc') {
        const npc = npcs.value.find(n => n.id === member.entityId)
        if (npc) {
          const npcOrgIds = (npc.organizationIds || []).filter(id => id !== org.value!.id)
          await updateDoc(doc(db, 'npcs', npc.id), { organizationIds: npcOrgIds })
        }
      }
    }
    await deleteDoc(doc(db, 'organizations', org.value.id))
    router.push('/organizations')
  } catch (e) {
    console.error('Failed to delete organization:', e)
    alert('Failed to delete organization.')
  }
}
</script>

<template>
  <div>
    <RouterLink to="/organizations" class="text-[#ef233c] hover:text-red-400 text-sm mb-4 inline-block transition-colors">← Back to Organizations</RouterLink>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="!org" class="text-center py-12">
      <p class="text-zinc-500">Organization not found.</p>
      <RouterLink to="/organizations" class="text-[#ef233c] text-sm mt-2 inline-block">← Back to organizations</RouterLink>
    </div>

    <div v-else>
      <!-- Hero section -->
      <div class="flex flex-col md:flex-row gap-6 mb-8">
        <!-- Sigil -->
        <div class="w-48 md:w-56 shrink-0 mx-auto md:mx-0">
          <div v-if="org.imageUrl" class="relative group overflow-hidden rounded-xl border border-white/10 aspect-square cursor-pointer" @click="showImageOverlay = true">
            <img :src="org.imageUrl" class="w-full h-full object-cover" />
            <button
              v-if="canManage"
              @click.stop="deleteSigil"
              class="absolute top-2 right-2 bg-black/60 hover:bg-red-600/80 text-white/70 hover:text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 text-xs backdrop-blur-sm"
              title="Delete sigil"
            >🗑️</button>
          </div>
          <div v-else class="w-full aspect-square rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <span class="text-5xl opacity-30">🏛️</span>
          </div>

          <!-- Sigil management (DM/Admin) -->
          <div v-if="canManage" class="mt-3">
            <div v-if="showSigilSection" class="space-y-2">
              <label class="label text-xs block">🎨 Sigil Prompt</label>
              <textarea v-model="sigilPrompt" class="input w-full text-xs" rows="4" />
              <button @click="generateSigil" :disabled="generatingSigil" class="btn !text-xs w-full flex items-center justify-center gap-2">
                <svg v-if="generatingSigil" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ generatingSigil ? 'Generating...' : '🎨 AI Generate Sigil' }}
              </button>
              <div v-if="genError" class="text-red-400 text-xs">{{ genError }}</div>
              <label class="btn !text-xs !bg-white/5 !text-zinc-400 w-full text-center cursor-pointer block">
                📷 Upload Image
                <input type="file" accept="image/*" class="hidden" @change="uploadSigil" />
              </label>
              <div v-if="uploadingSigil" class="mt-1">
                <div class="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div class="h-full bg-[#ef233c] transition-all duration-300" :style="{ width: uploadProgress + '%' }" />
                </div>
                <p class="text-xs text-zinc-600 mt-0.5 text-center">{{ uploadProgress }}%</p>
              </div>
              <button @click="showSigilSection = false" class="text-xs text-zinc-600 hover:text-zinc-400 w-full text-center">Close</button>
            </div>
            <button v-else @click="openSigilSection" class="btn !text-xs !bg-white/5 !text-zinc-400 w-full">
              🎨 {{ org.imageUrl ? 'Change Sigil' : 'Add Sigil' }}
            </button>
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h1 class="text-3xl font-bold text-white" style="font-family: Manrope, sans-serif">{{ org.name }}</h1>
              <span class="text-zinc-600 text-sm">{{ (org.members || []).length }} members</span>
            </div>
            <div class="flex items-center gap-2">
              <button v-if="canManage" @click="openEditModal" class="btn !text-xs !py-1.5">✏️ Edit</button>
              <button v-if="canManage" @click="deleteOrg" class="btn !text-xs !py-1.5 !bg-red-500/15 !text-red-400">🗑️</button>
            </div>
          </div>

          <div v-if="org.description" class="card mt-4 p-4 relative z-10">
            <div class="relative z-10">
              <p class="text-zinc-300 whitespace-pre-wrap">{{ org.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Hierarchical Member Display -->
      <div class="border-t border-white/[0.06] pt-6">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">👥 Members</h2>
          <button v-if="canManage" @click="showAddMember = !showAddMember" class="btn !text-xs">
            {{ showAddMember ? '✕ Close' : '+ Add Member' }}
          </button>
        </div>

        <!-- Add member panel -->
        <div v-if="showAddMember && canManage" class="card relative z-10 mb-6">
          <div class="relative z-10 p-4 space-y-3">
            <div class="flex gap-1 mb-2">
              <button
                @click="memberEntityTab = 'npc'; memberSearch = ''"
                :class="['px-3 py-1.5 rounded-lg text-xs font-medium transition-all', memberEntityTab === 'npc' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/5 text-zinc-500 hover:text-zinc-300']"
              >👤 NPC</button>
              <button
                @click="memberEntityTab = 'character'; memberSearch = ''"
                :class="['px-3 py-1.5 rounded-lg text-xs font-medium transition-all', memberEntityTab === 'character' ? 'bg-[#ef233c]/15 text-[#ef233c]' : 'bg-white/5 text-zinc-500 hover:text-zinc-300']"
              >🧙 Character</button>
            </div>

            <div class="flex gap-2">
              <input
                v-model="memberSearch"
                class="input flex-1"
                :placeholder="memberEntityTab === 'npc' ? 'Search NPCs to add...' : 'Search characters to add...'"
              />
              <select v-model="selectedRank" class="input !w-auto">
                <option v-for="r in ALL_RANKS" :key="r" :value="r">{{ RANK_LABELS[r] }}</option>
              </select>
            </div>

            <!-- NPC list -->
            <template v-if="memberEntityTab === 'npc'">
              <div v-if="filteredNpcsForAdd.length > 0" class="space-y-1 max-h-60 overflow-y-auto">
                <button
                  v-for="npc in filteredNpcsForAdd" :key="npc.id"
                  @click="addNpcMember(npc)"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                >
                  <img v-if="npc.imageUrl" :src="npc.imageUrl" class="w-7 h-7 rounded-full object-cover" />
                  <div v-else class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 text-xs">👤</div>
                  <span class="text-sm text-zinc-300">{{ npc.name }}</span>
                  <span class="text-[0.65rem] text-zinc-600">{{ npc.race }}</span>
                </button>
              </div>
              <div v-else-if="memberSearch" class="text-zinc-600 text-xs px-1">No matching NPCs found.</div>
              <div v-else class="text-zinc-700 text-xs px-1">Type to search NPCs...</div>
            </template>

            <!-- Character list -->
            <template v-if="memberEntityTab === 'character'">
              <div v-if="filteredCharsForAdd.length > 0" class="space-y-1 max-h-60 overflow-y-auto">
                <button
                  v-for="char in filteredCharsForAdd" :key="char.id"
                  @click="addCharacterMember(char)"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                >
                  <img v-if="char.imageUrl" :src="char.imageUrl" class="w-7 h-7 rounded-full object-cover" />
                  <div v-else class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 text-xs">🧙</div>
                  <span class="text-sm text-zinc-300">{{ char.name }}</span>
                  <span class="text-[0.65rem] text-zinc-600">{{ char.race }} {{ char.class }}</span>
                </button>
              </div>
              <div v-else-if="memberSearch" class="text-zinc-600 text-xs px-1">No matching characters found.</div>
              <div v-else class="text-zinc-700 text-xs px-1">Type to search characters...</div>
            </template>
          </div>
        </div>

        <!-- Members hierarchy -->
        <div v-if="(org.members || []).length === 0" class="card p-8 text-center relative z-10">
          <div class="relative z-10">
            <p class="text-zinc-600">No members yet.</p>
            <button v-if="canManage && !showAddMember" @click="showAddMember = true" class="btn text-sm mt-3">Add the first member</button>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div v-for="group in membersByRank" :key="group.rank">
            <!-- Rank header -->
            <div class="flex items-center gap-2 mb-2" :class="{ 'ml-0': group.rank === 'leader', 'ml-2': group.rank === 'subleader', 'ml-4': group.rank === 'officer', 'ml-6': group.rank === 'underofficer', 'ml-8': group.rank === 'member', 'ml-10': group.rank === 'initiate' }">
              <span class="text-sm">{{ group.icon }}</span>
              <h3 class="text-xs font-semibold uppercase tracking-wider" :class="{
                'text-[#ef233c]': group.rank === 'leader',
                'text-orange-400': group.rank === 'subleader',
                'text-blue-400': group.rank === 'officer',
                'text-teal-400': group.rank === 'underofficer',
                'text-zinc-500': group.rank === 'member',
                'text-zinc-600': group.rank === 'initiate',
              }">{{ group.label }}s ({{ group.members.length }})</h3>
            </div>

            <!-- Members in this rank -->
            <div class="space-y-1" :class="{ 'ml-0': group.rank === 'leader', 'ml-2': group.rank === 'subleader', 'ml-4': group.rank === 'officer', 'ml-6': group.rank === 'underofficer', 'ml-8': group.rank === 'member', 'ml-10': group.rank === 'initiate' }">
              <div
                v-for="member in group.members" :key="member.entityId"
                class="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Portrait thumbnail -->
                  <img
                    v-if="getMemberImageUrl(member)"
                    :src="getMemberImageUrl(member)"
                    class="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10"
                  />
                  <div v-else class="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 text-sm shrink-0">
                    {{ member.entityType === 'npc' ? '👤' : '🧙' }}
                  </div>

                  <!-- Name + badges -->
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <NpcLink
                        v-if="member.entityType === 'npc'"
                        :npcId="member.entityId"
                        :name="member.name"
                      />
                      <RouterLink
                        v-else
                        :to="'/characters/' + member.entityId"
                        class="text-sm text-zinc-300 hover:text-[#ef233c] transition-colors"
                      >{{ member.name }}</RouterLink>

                      <span class="text-[0.6rem] px-2 py-0.5 rounded-full" :class="getRankBadgeClass(member.rank)">
                        {{ RANK_LABELS[member.rank] }}
                      </span>
                      <span class="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-600">
                        {{ member.entityType === 'npc' ? 'NPC' : 'Player' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Admin controls -->
                <div v-if="canManage" class="flex items-center gap-2 shrink-0 ml-2">
                  <select
                    :value="member.rank"
                    @change="(e: any) => changeMemberRank(member, e.target.value)"
                    class="input !py-0.5 !px-2 !text-[0.65rem] !w-auto"
                  >
                    <option v-for="r in ALL_RANKS" :key="r" :value="r">{{ RANK_LABELS[r] }}</option>
                  </select>
                  <button
                    @click="removeMember(member)"
                    class="text-zinc-700 hover:text-red-400 text-xs transition-colors"
                    title="Remove member"
                  >✕</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showEditModal && org" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showEditModal = false" />
          <div class="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-[#ef233c]" style="font-family: Manrope, sans-serif">✏️ Edit {{ org.name }}</h3>
              <button @click="showEditModal = false" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="label text-xs mb-1 block">Name</label>
                <input v-model="editForm.name" class="input w-full" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Description</label>
                <textarea v-model="editForm.description" class="input w-full" rows="4" />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button @click="showEditModal = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="savingEdit || !editForm.name.trim()" class="btn text-sm inline-flex items-center gap-1.5">
                <svg v-if="savingEdit" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {{ savingEdit ? 'Saving...' : '💾 Save' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Image Overlay -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="showImageOverlay && org?.imageUrl" class="fixed inset-0 z-[60] flex items-center justify-center p-4" @click="showImageOverlay = false">
          <div class="fixed inset-0 bg-black/85 backdrop-blur-sm" />
          <img :src="org.imageUrl" class="relative z-10 max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" @click.stop />
          <button @click="showImageOverlay = false" class="absolute top-4 right-4 z-20 text-white/60 hover:text-white text-2xl transition-colors">✕</button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

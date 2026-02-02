<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, collection, query, orderBy, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import { useImageGen } from '../composables/useImageGen'
import { cleanupNpcReferences } from '../lib/entityCleanup'
import type { Npc, Organization } from '../types'
import TagInput from '../components/common/TagInput.vue'
import NotesSection from '../components/common/NotesSection.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { error: genError, generateImage } = useImageGen()

const npc = ref<Npc | null>(null)
const orgs = ref<Organization[]>([])
const loading = ref(true)

// Edit state
const showEditModal = ref(false)
const editForm = ref({ name: '', race: '', description: '', appearance: '', locationEncountered: '', tags: [] as string[] })
const savingEdit = ref(false)
const portraitPrompt = ref('')
const generatingPortrait = ref(false)
const showImageOverlay = ref(false)

const npcId = computed(() => route.params.id as string)

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(doc(db, 'npcs', npcId.value), (snap) => {
    if (snap.exists()) {
      npc.value = { id: snap.id, ...snap.data() } as Npc
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load NPC:', e)
    loading.value = false
  }))

  _unsubs.push(onSnapshot(query(collection(db, 'organizations'), orderBy('name', 'asc')), (snap) => {
    orgs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization))
  }, (e) => console.error('Failed to load organizations:', e)))
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

const npcOrgs = computed(() => {
  if (!npc.value?.organizationIds?.length) return []
  return orgs.value.filter(o => npc.value!.organizationIds.includes(o.id))
})

const isDeceased = computed(() => (npc.value?.tags || []).includes('deceased'))

function getRoleBadge(): string | null {
  if (!npc.value) return null
  if ((npc.value.tags || []).includes('commander')) return 'Commander'
  if ((npc.value.tags || []).includes('leader')) return 'Leader'
  if ((npc.value.tags || []).includes('subleader')) return 'Vice-Leader'
  return null
}

function getUnitAbbrev(): string | null {
  if (!npc.value) return null
  const unitTags = ['ZFC', 'LDU', 'DDU', 'GDU', 'PCU', 'EFDU', 'UEU', 'VIU']
  return (npc.value.tags || []).find(t => unitTags.includes(t)) || null
}

function getDefaultPortraitPrompt(): string {
  if (!npc.value) return ''
  const appearanceStr = npc.value.appearance ? ` Appearance: ${npc.value.appearance}.` : ''
  return `Fantasy character portrait for a D&D RPG. ${npc.value.name}, a ${npc.value.race || 'unknown race'}.${appearanceStr} ${npc.value.description || ''}. Style: detailed fantasy art, medieval setting, dramatic lighting, painterly. Head and shoulders portrait.`
}

// --- Edit ---
function openEditModal() {
  if (!npc.value) return
  editForm.value = {
    name: npc.value.name,
    race: npc.value.race || '',
    description: npc.value.description || '',
    appearance: npc.value.appearance || '',
    locationEncountered: npc.value.locationEncountered || '',
    tags: [...(npc.value.tags || [])],
  }
  portraitPrompt.value = getDefaultPortraitPrompt()
  showEditModal.value = true
}

async function saveEdit() {
  if (!npc.value) return
  savingEdit.value = true
  const updates: Partial<Npc> = {
    name: editForm.value.name.trim(),
    race: editForm.value.race.trim(),
    description: editForm.value.description.trim(),
    appearance: editForm.value.appearance.trim() || '',
    locationEncountered: editForm.value.locationEncountered.trim(),
    tags: editForm.value.tags,
    updatedAt: new Date(),
  }
  try {
    await updateDoc(doc(db, 'npcs', npc.value.id), updates as any)
    Object.assign(npc.value, updates)
    showEditModal.value = false
  } catch (e) {
    console.error('Failed to save NPC:', e)
    alert('Failed to save.')
  } finally {
    savingEdit.value = false
  }
}

async function generatePortrait() {
  if (!npc.value) return
  generatingPortrait.value = true
  const url = await generateImage(portraitPrompt.value, `npc-portraits/${npc.value.id}`)
  if (url) {
    await updateDoc(doc(db, 'npcs', npc.value.id), { imageUrl: url })
    npc.value.imageUrl = url
  }
  generatingPortrait.value = false
}

async function deletePortrait() {
  if (!npc.value || !confirm('Delete this portrait?')) return
  try {
    await updateDoc(doc(db, 'npcs', npc.value.id), { imageUrl: '' })
    npc.value.imageUrl = ''
  } catch (e) {
    console.error('Failed to delete portrait:', e)
    alert('Failed to delete portrait.')
  }
}

async function deleteNpc() {
  if (!npc.value) return
  if (!confirm(`Delete "${npc.value.name}"? This cannot be undone.`)) return
  try {
    await cleanupNpcReferences(npc.value.id)
    await deleteDoc(doc(db, 'npcs', npc.value.id))
    router.push('/npcs')
  } catch (e) {
    console.error('Failed to delete NPC:', e)
    alert('Failed to delete NPC.')
  }
}


</script>

<template>
  <div>
    <RouterLink to="/npcs" class="text-[#ef233c] hover:text-red-400 text-sm mb-4 inline-block transition-colors">← Back to NPCs</RouterLink>

    <div v-if="loading" class="text-zinc-500 animate-pulse">Loading...</div>

    <div v-else-if="!npc" class="text-center py-12">
      <p class="text-zinc-500">NPC not found.</p>
    </div>

    <div v-else>
      <!-- Hero section -->
      <div class="flex flex-col md:flex-row gap-6 mb-8">
        <!-- Portrait -->
        <div class="w-48 md:w-56 shrink-0 mx-auto md:mx-0">
          <div v-if="npc.imageUrl" class="relative group overflow-hidden rounded-xl border border-white/10 aspect-square cursor-pointer" @click="showImageOverlay = true">
            <img :src="npc.imageUrl" class="w-full h-full object-cover" />
            <button
              v-if="auth.isAdmin || auth.isDm"
              @click="deletePortrait"
              class="absolute top-2 right-2 bg-black/60 hover:bg-red-600/80 text-white/70 hover:text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 text-xs backdrop-blur-sm"
              title="Delete portrait"
            >🗑️</button>
          </div>
          <div v-else class="w-full aspect-square rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <span class="text-4xl">👤</span>
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h1 :class="['text-3xl font-bold', isDeceased ? 'line-through text-zinc-500' : 'text-white']" style="font-family: Manrope, sans-serif">{{ npc.name }}</h1>
              <span class="text-zinc-500 text-lg">{{ npc.race }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="auth.isAuthenticated && !auth.isGuest"
                @click="openEditModal"
                class="btn !text-xs !py-1.5"
              >✏️ Edit</button>
              <button
                v-if="auth.isDm || auth.isAdmin"
                @click="deleteNpc"
                class="btn !text-xs !py-1.5 !bg-red-500/15 !text-red-400"
              >🗑️</button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mt-3">
            <span v-if="getRoleBadge()" class="badge bg-[#ef233c]/15 text-[#ef233c]">{{ getRoleBadge() }}</span>
            <span v-if="getUnitAbbrev()" class="badge bg-white/5 text-zinc-400">{{ getUnitAbbrev() }}</span>
            <span v-if="isDeceased" class="badge bg-zinc-800 text-zinc-500">☠️ Deceased</span>
            <span v-for="tag in (npc.tags || []).filter(t => !['commander','leader','subleader','deceased','ZFC','LDU','DDU','GDU','PCU','EFDU','UEU','VIU'].includes(t))" :key="tag" class="text-[0.65rem] px-2 py-0.5 rounded-full bg-white/5 text-zinc-500">{{ tag }}</span>
          </div>

          <div v-if="npc.appearance" class="mt-3 text-sm">
            <span class="text-zinc-600">🎨 Appearance:</span>
            <span class="text-zinc-400 ml-1 italic">{{ npc.appearance }}</span>
          </div>

          <div class="card mt-4 p-4 relative z-10">
            <div class="relative z-10">
              <p class="text-zinc-300 whitespace-pre-wrap">{{ npc.description }}</p>
            </div>
          </div>

          <div v-if="npc.locationEncountered" class="mt-3 text-sm">
            <span class="text-zinc-600">📍 First encountered at:</span>
            <span class="text-zinc-400 ml-1">{{ npc.locationEncountered }}</span>
          </div>

          <!-- Organizations -->
          <div v-if="npcOrgs.length" class="mt-3">
            <span class="text-zinc-600 text-sm">🏛️ Organizations: </span>
            <RouterLink
              v-for="(org, i) in npcOrgs" :key="org.id"
              :to="'/organizations#' + org.id"
              class="text-sm text-zinc-400 hover:text-[#ef233c] transition-colors"
            >{{ org.name }}<span v-if="i < npcOrgs.length - 1">, </span></RouterLink>
          </div>
        </div>
      </div>

      <!-- Notes Section -->
      <div class="border-t border-white/[0.06] pt-6">
        <NotesSection
          v-if="npcId"
          collection-name="npcNotes"
          parent-id-field="npcId"
          :parent-id-value="npcId"
          title="📝 Notes"
          variant="full"
        />
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
        <div v-if="showEditModal && npc" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="showEditModal = false" />
          <div class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 z-10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white" style="font-family: Manrope, sans-serif">✏️ Edit {{ npc.name }}</h3>
              <button @click="showEditModal = false" class="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <div v-if="npc.imageUrl" class="overflow-hidden rounded-xl">
              <img :src="npc.imageUrl" class="w-full h-48 object-cover" />
            </div>

            <div class="space-y-3">
              <div><label class="label text-xs mb-1 block">Name</label><input v-model="editForm.name" class="input w-full" /></div>
              <div><label class="label text-xs mb-1 block">Race</label><input v-model="editForm.race" class="input w-full" /></div>
              <div><label class="label text-xs mb-1 block">Description</label><textarea v-model="editForm.description" class="input w-full" rows="4" /></div>
              <div>
                <label class="label text-xs mb-1 block">Appearance <span class="text-zinc-600 font-normal">({{ editForm.appearance.length }}/200 — used for AI art)</span></label>
                <input v-model="editForm.appearance" class="input w-full" maxlength="200" placeholder="e.g. Grizzled dwarf with braided grey beard, missing left eye, wears chainmail" />
              </div>
              <div><label class="label text-xs mb-1 block">Location Encountered</label><input v-model="editForm.locationEncountered" class="input w-full" /></div>
              <div><label class="label text-xs mb-1 block">Tags</label><TagInput v-model="editForm.tags" /></div>

              <div class="pt-2 border-t border-white/[0.06]">
                <label class="label text-xs mb-1 block">🎨 Portrait Generation Prompt</label>
                <textarea v-model="portraitPrompt" class="input w-full text-xs" rows="3" />
                <button @click="generatePortrait" :disabled="generatingPortrait" class="btn !text-xs !py-1.5 mt-2 w-full flex items-center justify-center gap-2">
                  <svg v-if="generatingPortrait" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {{ generatingPortrait ? 'Generating portrait...' : '🎨 Generate Portrait' }}
                </button>
                <div v-if="genError && generatingPortrait" class="text-red-400 text-xs mt-1">{{ genError }}</div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button @click="showEditModal = false" class="btn !bg-white/5 !text-zinc-400 text-sm">Cancel</button>
              <button @click="saveEdit" :disabled="savingEdit || !editForm.name.trim()" class="btn text-sm">{{ savingEdit ? 'Saving...' : '💾 Save' }}</button>
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
        <div v-if="showImageOverlay && npc?.imageUrl" class="fixed inset-0 z-[60] flex items-center justify-center p-4" @click="showImageOverlay = false">
          <div class="fixed inset-0 bg-black/85 backdrop-blur-sm" />
          <img :src="npc.imageUrl" class="relative z-10 max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" @click.stop />
          <button @click="showImageOverlay = false" class="absolute top-4 right-4 z-20 text-white/60 hover:text-white text-2xl transition-colors">✕</button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, updateDoc, deleteDoc, collection, query, orderBy, Timestamp, onSnapshot } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuthStore } from '../stores/auth'
import type { Character } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const character = ref<Character | null>(null)
const loading = ref(true)
const editing = ref(false)
const editForm = ref({ name: '', race: '', class: '', level: 1, description: '', appearance: '' })
const uploadingImage = ref(false)
const uploadProgress = ref(0)

// Users for assign dropdown (DM/Admin)
const users = ref<{ uid: string; displayName: string }[]>([])
const assigningUser = ref(false)

const canEdit = computed(() => {
  if (!character.value || !auth.firebaseUser) return false
  return character.value.userId === auth.firebaseUser.uid || auth.isDm || auth.isAdmin
})

const _unsubs: (() => void)[] = []

onMounted(() => {
  _unsubs.push(onSnapshot(doc(db, 'characters', route.params.id as string), (snap) => {
    if (snap.exists()) {
      character.value = { id: snap.id, ...snap.data() } as Character
    }
    loading.value = false
  }, (e) => {
    console.error('Failed to load character:', e)
    loading.value = false
  }))

  if (auth.isDm || auth.isAdmin) {
    _unsubs.push(onSnapshot(query(collection(db, 'users'), orderBy('displayName', 'asc')), (snap) => {
      users.value = snap.docs.map(d => ({ uid: d.id, displayName: d.data().displayName || d.data().email || d.id }))
    }, (e) => console.error('Failed to load users:', e)))
  }
})

onUnmounted(() => _unsubs.forEach(fn => fn()))

function getOwnerName(userId?: string): string {
  if (!userId) return 'Unassigned'
  const u = users.value.find(u => u.uid === userId)
  return u?.displayName || 'Unknown Player'
}

function startEdit() {
  if (!character.value) return
  editForm.value = {
    name: character.value.name,
    race: character.value.race,
    class: character.value.class,
    level: character.value.level,
    description: character.value.description || '',
    appearance: character.value.appearance || ''
  }
  editing.value = true
}

async function saveEdit() {
  if (!character.value || !editForm.value.name.trim()) return
  const updates = {
    name: editForm.value.name.trim(),
    race: editForm.value.race.trim(),
    class: editForm.value.class.trim(),
    level: editForm.value.level,
    description: editForm.value.description.trim(),
    appearance: editForm.value.appearance.trim() || null,
    updatedAt: Timestamp.now()
  }
  try {
    await updateDoc(doc(db, 'characters', character.value.id), updates)
    Object.assign(character.value, updates)
    editing.value = false
  } catch (e) {
    console.error('Failed to save:', e)
    alert('Failed to save changes.')
  }
}

// All images: imageUrl first, then galleryUrls
const allImages = computed(() => {
  if (!character.value) return []
  const imgs: string[] = []
  if (character.value.imageUrl) imgs.push(character.value.imageUrl)
  if (character.value.galleryUrls) imgs.push(...character.value.galleryUrls)
  return imgs
})

const lightboxIndex = ref<number | null>(null)

async function uploadImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !character.value) return
  uploadingImage.value = true
  uploadProgress.value = 0
  const timestamp = Date.now()
  const ext = file.name.split('.').pop() || 'jpg'
  const fileRef = storageRef(storage, `characters/${character.value.id}/${timestamp}.${ext}`)
  const uploadTask = uploadBytesResumable(fileRef, file)

  uploadTask.on('state_changed',
    (snapshot) => { uploadProgress.value = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) },
    (error) => { console.error('Upload failed:', error); uploadingImage.value = false; alert('Upload failed.') },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      const c = character.value!
      if (!c.imageUrl) {
        // First image becomes the portrait
        await updateDoc(doc(db, 'characters', c.id), { imageUrl: url, updatedAt: Timestamp.now() })
        c.imageUrl = url
      } else {
        // Additional images go to gallery
        const gallery = [...(c.galleryUrls || []), url]
        await updateDoc(doc(db, 'characters', c.id), { galleryUrls: gallery, updatedAt: Timestamp.now() })
        c.galleryUrls = gallery
      }
      uploadingImage.value = false
      uploadProgress.value = 0
    }
  )
}

async function removeImage() {
  if (!character.value || !character.value.imageUrl) return
  if (!confirm('Remove character portrait?')) return
  try {
    const gallery = character.value.galleryUrls || []
    if (gallery.length > 0) {
      // Promote first gallery image to portrait
      const [newPortrait, ...rest] = gallery
      await updateDoc(doc(db, 'characters', character.value.id), {
        imageUrl: newPortrait,
        galleryUrls: rest,
        updatedAt: Timestamp.now()
      })
      character.value.imageUrl = newPortrait
      character.value.galleryUrls = rest
    } else {
      await updateDoc(doc(db, 'characters', character.value.id), { imageUrl: null, updatedAt: Timestamp.now() })
      character.value.imageUrl = undefined
    }
  } catch (e) {
    console.error('Failed to remove image:', e)
  }
}

async function removeGalleryImage(index: number) {
  if (!character.value) return
  const gallery = [...(character.value.galleryUrls || [])]
  gallery.splice(index, 1)
  try {
    await updateDoc(doc(db, 'characters', character.value.id), { galleryUrls: gallery, updatedAt: Timestamp.now() })
    character.value.galleryUrls = gallery
  } catch (e) {
    console.error('Failed to remove gallery image:', e)
  }
}

async function setAsPortrait(galleryIndex: number) {
  if (!character.value) return
  const gallery = [...(character.value.galleryUrls || [])]
  const newPortrait = gallery.splice(galleryIndex, 1)[0]!
  // Move current portrait to gallery
  if (character.value.imageUrl) {
    gallery.unshift(character.value.imageUrl)
  }
  try {
    await updateDoc(doc(db, 'characters', character.value.id), {
      imageUrl: newPortrait,
      galleryUrls: gallery,
      updatedAt: Timestamp.now()
    })
    character.value.imageUrl = newPortrait
    character.value.galleryUrls = gallery
  } catch (e) {
    console.error('Failed to set portrait:', e)
  }
}

async function toggleActive() {
  if (!character.value) return
  const newActive = !character.value.isActive
  try {
    await updateDoc(doc(db, 'characters', character.value.id), { isActive: newActive, updatedAt: Timestamp.now() })
    character.value.isActive = newActive
  } catch (e) {
    console.error('Failed to toggle active:', e)
  }
}

async function assignUser(userId: string | null) {
  if (!character.value) return
  try {
    await updateDoc(doc(db, 'characters', character.value.id), { userId: userId || null, updatedAt: Timestamp.now() })
    character.value.userId = userId || undefined
    assigningUser.value = false
  } catch (e) {
    console.error('Failed to assign:', e)
  }
}

async function deleteCharacter() {
  if (!character.value) return
  if (!confirm(`Delete "${character.value.name}"? This cannot be undone.`)) return
  try {
    await deleteDoc(doc(db, 'characters', character.value.id))
    router.push('/characters')
  } catch (e) {
    console.error('Failed to delete:', e)
    alert('Failed to delete character.')
  }
}
</script>

<template>
  <div>
    <!-- Back link -->
    <RouterLink to="/characters" class="text-zinc-600 hover:text-zinc-400 text-sm transition-colors mb-4 inline-block">← All Characters</RouterLink>

    <div v-if="loading" class="text-zinc-500 animate-pulse mt-4">Loading character...</div>

    <div v-else-if="!character" class="card p-10 text-center relative z-10 mt-4">
      <div class="relative z-10">
        <p class="text-zinc-500">Character not found.</p>
        <RouterLink to="/characters" class="text-[#ef233c] text-sm mt-2 inline-block">← Back to characters</RouterLink>
      </div>
    </div>

    <div v-else class="mt-2">
      <!-- Header -->
      <div class="flex flex-col md:flex-row gap-6 mb-6">
        <!-- Portrait -->
        <div class="shrink-0 w-full md:w-64">
          <div class="relative group">
            <div v-if="character.imageUrl" class="rounded-xl overflow-hidden border border-white/10 cursor-pointer" @click="lightboxIndex = 0">
              <img :src="character.imageUrl" :alt="character.name" class="w-full aspect-[3/4] object-cover" />
            </div>
            <div v-else class="rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center aspect-[3/4]">
              <span class="text-6xl opacity-30">🧙</span>
            </div>
            <!-- Upload overlay -->
            <div v-if="canEdit" class="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <label class="btn !text-xs cursor-pointer">
                📷 {{ character.imageUrl ? 'Add Photo' : 'Upload Portrait' }}
                <input type="file" accept="image/*" class="hidden" @change="uploadImage" />
              </label>
              <button v-if="character.imageUrl" @click.stop="removeImage" class="btn !text-xs !bg-red-500/20 !text-red-400">✕ Remove Portrait</button>
            </div>
          </div>
          <!-- Upload progress -->
          <div v-if="uploadingImage" class="mt-2">
            <div class="h-1 bg-white/10 rounded-full overflow-hidden">
              <div class="h-full bg-[#ef233c] transition-all duration-300" :style="{ width: uploadProgress + '%' }" />
            </div>
            <p class="text-xs text-zinc-600 mt-1 text-center">{{ uploadProgress }}%</p>
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <!-- View mode -->
          <div v-if="!editing">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h1 class="text-3xl font-bold tracking-tight text-white" style="font-family: Manrope, sans-serif">{{ character.name }}</h1>
                <div class="flex items-center gap-3 mt-2 flex-wrap">
                  <span v-if="character.race" class="text-zinc-400">{{ character.race }}</span>
                  <span v-if="character.class" class="text-zinc-300 font-medium">{{ character.class }}</span>
                  <span class="badge bg-[#ef233c]/15 text-[#ef233c] text-sm">Level {{ character.level }}</span>
                  <span v-if="!character.isActive" class="badge bg-zinc-800 text-zinc-500">Inactive</span>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button v-if="canEdit" @click="startEdit" class="btn !text-xs">✏️ Edit</button>
                <button v-if="canEdit" @click="toggleActive" :class="['btn !text-xs', character.isActive ? '!bg-amber-500/15 !text-amber-400' : '!bg-green-500/15 !text-green-400']">
                  {{ character.isActive ? '💤 Retire' : '⚡ Activate' }}
                </button>
                <button v-if="auth.isDm || auth.isAdmin" @click="deleteCharacter" class="btn !text-xs !bg-red-500/15 !text-red-400">🗑️</button>
              </div>
            </div>

            <!-- Owner info -->
            <div class="mt-4 flex items-center gap-2">
              <span class="text-xs text-zinc-600">🎮 Player:</span>
              <template v-if="assigningUser && (auth.isDm || auth.isAdmin)">
                <select @change="(e: any) => assignUser(e.target.value || null)" class="input !text-xs !py-1">
                  <option value="">Unassigned</option>
                  <option v-for="u in users" :key="u.uid" :value="u.uid" :selected="character.userId === u.uid">{{ u.displayName }}</option>
                </select>
                <button @click="assigningUser = false" class="text-zinc-600 text-xs">✕</button>
              </template>
              <template v-else>
                <span class="text-sm text-zinc-400">{{ getOwnerName(character.userId) }}</span>
                <button v-if="auth.isDm || auth.isAdmin" @click="assigningUser = true" class="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">✏️</button>
              </template>
            </div>

            <!-- Appearance -->
            <div v-if="character.appearance" class="mt-4">
              <h2 class="label mb-1">Appearance <span class="text-zinc-600 font-normal text-[0.65rem]">🎨 used for AI art</span></h2>
              <p class="text-zinc-500 text-sm italic">{{ character.appearance }}</p>
            </div>

            <!-- Description -->
            <div v-if="character.description" class="mt-6">
              <h2 class="label mb-2">Description</h2>
              <p class="text-zinc-400 whitespace-pre-wrap">{{ character.description }}</p>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-else class="space-y-4">
            <div>
              <label class="label text-xs block mb-1">Name *</label>
              <input v-model="editForm.name" class="input w-full" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="label text-xs block mb-1">Race</label>
                <input v-model="editForm.race" class="input w-full" placeholder="e.g. Human, Elf, Dwarf" />
              </div>
              <div>
                <label class="label text-xs block mb-1">Class</label>
                <input v-model="editForm.class" class="input w-full" placeholder="e.g. Fighter, Wizard" />
              </div>
            </div>
            <div>
              <label class="label text-xs block mb-1">Level</label>
              <input v-model.number="editForm.level" type="number" min="1" max="20" class="input w-24" />
            </div>
            <div>
              <label class="label text-xs block mb-1">Appearance <span class="text-zinc-600 font-normal">({{ editForm.appearance.length }}/200 — used for AI art)</span></label>
              <input v-model="editForm.appearance" class="input w-full" maxlength="200" placeholder="e.g. Tall half-elf with silver hair, blue eyes, wears leather armor and a tattered red cloak" />
            </div>
            <div>
              <label class="label text-xs block mb-1">Description</label>
              <textarea v-model="editForm.description" class="input w-full" rows="5" placeholder="Backstory, personality, notable traits..." />
            </div>
            <div class="flex gap-2">
              <button @click="saveEdit" :disabled="!editForm.name.trim()" class="btn">💾 Save</button>
              <button @click="editing = false" class="btn !bg-white/5 !text-zinc-400">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Gallery -->
      <div v-if="allImages.length > 1 || canEdit" class="mt-2">
        <h2 class="label mb-3">Gallery ({{ allImages.length }})</h2>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          <div v-for="(img, i) in allImages" :key="img" class="relative group/thumb rounded-lg overflow-hidden border border-white/10 cursor-pointer aspect-square" @click="lightboxIndex = i">
            <img :src="img" class="w-full h-full object-cover" />
            <div v-if="i === 0" class="absolute top-1 left-1 bg-black/70 text-[0.5rem] text-[#ef233c] font-bold uppercase px-1.5 py-0.5 rounded">Portrait</div>
            <!-- Actions overlay -->
            <div v-if="canEdit && i > 0" class="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button @click.stop="setAsPortrait(i - 1)" class="bg-black/70 text-white text-[0.6rem] px-2 py-1 rounded hover:bg-[#ef233c]/80 transition-colors" title="Set as portrait">⭐</button>
              <button @click.stop="removeGalleryImage(i - 1)" class="bg-black/70 text-red-400 text-[0.6rem] px-2 py-1 rounded hover:bg-red-500/40 transition-colors" title="Remove">✕</button>
            </div>
          </div>
          <!-- Add more button -->
          <label v-if="canEdit" class="rounded-lg border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center aspect-square cursor-pointer hover:border-white/20 hover:bg-white/[0.04] transition-colors">
            <div class="text-center">
              <div class="text-2xl text-zinc-700">+</div>
              <div class="text-[0.6rem] text-zinc-600">Add</div>
            </div>
            <input type="file" accept="image/*" class="hidden" @change="uploadImage" />
          </label>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="lightboxIndex !== null && allImages[lightboxIndex]" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center" @click="lightboxIndex = null">
          <img :src="allImages[lightboxIndex]" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" @click.stop />
          <!-- Nav buttons -->
          <button v-if="allImages.length > 1" @click.stop="lightboxIndex = (lightboxIndex! - 1 + allImages.length) % allImages.length" class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-xl">‹</button>
          <button v-if="allImages.length > 1" @click.stop="lightboxIndex = (lightboxIndex! + 1) % allImages.length" class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-xl">›</button>
          <!-- Close -->
          <button @click="lightboxIndex = null" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-lg">✕</button>
          <!-- Counter -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-zinc-400 text-sm">{{ lightboxIndex! + 1 }} / {{ allImages.length }}</div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

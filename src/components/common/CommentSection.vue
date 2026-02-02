<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'

defineProps<{
  targetType: string
  targetId: string
  comments: Array<{
    id: string
    authorName: string
    content: string
    isPrivate: boolean
    createdAt: Date
  }>
}>()

const emit = defineEmits<{
  'add-comment': [content: string, isPrivate: boolean]
}>()

const auth = useAuthStore()
const newComment = ref('')
const isPrivate = ref(false)

function submitComment() {
  if (!newComment.value.trim()) return
  emit('add-comment', newComment.value.trim(), isPrivate.value)
  newComment.value = ''
  isPrivate.value = false
}
</script>

<template>
  <div class="mt-6">
    <h3 class="text-lg font-semibold text-zinc-200 mb-3" style="font-family: Manrope, sans-serif">💬 Comments</h3>

    <div v-if="comments.length === 0" class="text-zinc-600 text-sm">No comments yet.</div>

    <div v-for="comment in comments" :key="comment.id" class="card-flat p-3 mb-2">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[#ef233c] text-sm font-medium">{{ comment.authorName }}</span>
        <span v-if="comment.isPrivate" class="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md border border-red-500/20">Private</span>
      </div>
      <p class="text-zinc-300 text-sm">{{ comment.content }}</p>
    </div>

    <div v-if="auth.isAuthenticated && !auth.isGuest" class="mt-4">
      <textarea v-model="newComment" rows="2" placeholder="Add a comment..." class="input w-full text-sm" />
      <div class="flex items-center justify-between mt-2">
        <label class="flex items-center gap-2 text-sm text-zinc-500">
          <input v-model="isPrivate" type="checkbox" class="accent-[#ef233c]" />
          Private (DM only)
        </label>
        <button @click="submitComment" class="btn text-sm">
          Post
        </button>
      </div>
    </div>
  </div>
</template>

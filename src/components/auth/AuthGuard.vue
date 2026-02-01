<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <slot v-if="auth.isAuthenticated" />
  <div v-else class="text-center mt-20">
    <p class="text-zinc-500">Please log in to access this page.</p>
  </div>
</template>

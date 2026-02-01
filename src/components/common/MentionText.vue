<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { renderMentionsHtml, hasMentions } from '../../lib/mentionRenderer'

const props = defineProps<{
  text: string
}>()

const router = useRouter()

const renderedHtml = computed(() => {
  if (!hasMentions(props.text)) return ''
  return renderMentionsHtml(props.text)
})

const containsMentions = computed(() => hasMentions(props.text))

function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('mention-link')) {
    e.preventDefault()
    const href = target.getAttribute('href')
    if (href) router.push(href)
  }
}
</script>

<template>
  <span v-if="containsMentions" v-html="renderedHtml" @click="onClick" />
  <span v-else>{{ text }}</span>
</template>

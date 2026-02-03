<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { renderMentionsHtml, hasMentions, parseMentions } from '../../lib/mentionRenderer'
import { useEntityExists } from '../../composables/useEntityExists'
import { showTooltip, hideTooltip } from '../../composables/useEntityTooltip'
import type { MentionKind } from '../../lib/mentionRenderer'

const props = defineProps<{
  text: string
}>()

const router = useRouter()
const { characterIds, npcIds, locationIds, featureIds, organizationIds } = useEntityExists()

const containsMentions = computed(() => hasMentions(props.text))

const deletedIds = computed(() => {
  if (!containsMentions.value) return undefined
  const tokens = parseMentions(props.text)
  const deleted = new Set<string>()
  for (const token of tokens) {
    if (token.kind === 'char' && characterIds.value.size > 0 && !characterIds.value.has(token.id)) {
      deleted.add(token.id)
    } else if (token.kind === 'npc' && npcIds.value.size > 0 && !npcIds.value.has(token.id)) {
      deleted.add(token.id)
    } else if (token.kind === 'location' && locationIds.value.size > 0 && !locationIds.value.has(token.id)) {
      deleted.add(token.id)
    } else if (token.kind === 'feature' && featureIds.value.size > 0 && !featureIds.value.has(token.id)) {
      deleted.add(token.id)
    } else if (token.kind === 'org' && organizationIds.value.size > 0 && !organizationIds.value.has(token.id)) {
      deleted.add(token.id)
    }
    // pin — no existence check (markers don't have a stable route, skip)
  }
  return deleted.size > 0 ? deleted : undefined
})

const renderedHtml = computed(() => {
  if (!containsMentions.value) return ''
  return renderMentionsHtml(props.text, deletedIds.value)
})

function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('mention-link')) {
    e.preventDefault()
    const href = target.getAttribute('href')
    if (href) router.push(href)
  }
}

function onMouseOver(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('mention-link') || target.classList.contains('mention-pin')) {
    const kind = target.dataset.mentionKind as MentionKind
    const id = target.dataset.mentionId
    if (kind && id) {
      const rect = target.getBoundingClientRect()
      showTooltip(kind, id, rect.left, rect.bottom + 6)
    }
  }
}

function onMouseOut(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('mention-link') || target.classList.contains('mention-pin')) {
    hideTooltip()
  }
}
</script>

<template>
  <span v-if="containsMentions" v-html="renderedHtml" @click="onClick" @mouseover="onMouseOver" @mouseout="onMouseOut" />
  <span v-else>{{ text }}</span>
</template>

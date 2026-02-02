/**
 * Mention renderer utility.
 * Parses mention tokens like @[Name](char:id), #[Name](location:id), ¦[Name](org:id)
 * and converts them to HTML with clickable links.
 */

export type MentionKind = 'char' | 'npc' | 'location' | 'feature' | 'pin' | 'org'

export interface MentionToken {
  name: string
  kind: MentionKind
  id: string
}

const MENTION_REGEX = /[@#¦]\[([^\]]+)\]\((char|npc|location|feature|pin|org):([^)]+)\)/g

/**
 * Parse all mention tokens from a text string.
 */
export function parseMentions(text: string): MentionToken[] {
  const tokens: MentionToken[] = []
  let match
  const regex = new RegExp(MENTION_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      name: match[1]!,
      kind: match[2] as MentionKind,
      id: match[3]!,
    })
  }
  return tokens
}

/** Map mention kind → route prefix (pin has no route) */
function kindRoute(kind: MentionKind, id: string): string | null {
  switch (kind) {
    case 'char': return `/characters/${id}`
    case 'npc': return `/npcs/${id}`
    case 'location': return `/locations/${id}`
    case 'feature': return `/features/${id}`
    case 'org': return `/organizations/${id}`
    case 'pin': return null
  }
}

/** Map mention kind → CSS color */
function kindColor(kind: MentionKind): string {
  switch (kind) {
    case 'char': return '#60a5fa'
    case 'npc': return '#fbbf24'
    case 'location': return '#4ade80'
    case 'feature': return '#2dd4bf'
    case 'pin': return '#c084fc'
    case 'org': return '#fb7185'
  }
}

/** Map mention kind → trigger prefix character */
function kindPrefix(kind: MentionKind): string {
  switch (kind) {
    case 'char':
    case 'npc':
      return '@'
    case 'location':
    case 'feature':
    case 'pin':
      return '#'
    case 'org':
      return '¦'
  }
}

/**
 * Convert a text string with mention tokens into HTML with router-links.
 * Returns an HTML string. Use with v-html.
 *
 * If `deletedIds` is provided, mentions whose ID is in the set will render
 * as a [DELETED] placeholder instead of a clickable link.
 */
export function renderMentionsHtml(text: string, deletedIds?: Set<string>): string {
  return text.replace(MENTION_REGEX, (_match, name: string, kind: string, id: string) => {
    if (deletedIds && deletedIds.has(id)) {
      return '<span class="mention-deleted" style="color: #666; text-decoration: line-through; font-style: italic;">[DELETED]</span>'
    }
    const k = kind as MentionKind
    const route = kindRoute(k, id)
    const color = kindColor(k)
    const prefix = kindPrefix(k)
    const escapedName = escapeHtml(name)

    if (route) {
      return `<a href="${route}" class="mention-link" style="color: ${color}; text-decoration: none; font-weight: 500;" data-mention-kind="${kind}" data-mention-id="${id}">${prefix}${escapedName}</a>`
    }
    // Pin — no link, just styled span
    return `<span class="mention-pin" style="color: ${color}; font-weight: 500;" data-mention-kind="${kind}" data-mention-id="${id}">${prefix}${escapedName}</span>`
  })
}

/**
 * Check if a text contains any mention tokens.
 */
export function hasMentions(text: string): boolean {
  // Reset lastIndex since MENTION_REGEX has the 'g' flag — .test() updates
  // lastIndex, which can cause alternating true/false on repeated calls.
  MENTION_REGEX.lastIndex = 0
  return MENTION_REGEX.test(text)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

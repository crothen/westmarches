/**
 * Mention renderer utility.
 * Parses mention tokens like @[Display Name](char:id), @[Display Name](npc:id),
 * #[Display Name](location:id), #[Display Name](feature:id), and ¦[Display Name](org:id)
 * and converts them to HTML with clickable links.
 */

export interface MentionToken {
  name: string
  kind: 'char' | 'npc' | 'location' | 'feature' | 'org'
  id: string
}

const MENTION_REGEX = /[@#¦]\[([^\]]+)\]\((char|npc|location|feature|org):([^)]+)\)/g

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
      kind: match[2] as MentionToken['kind'],
      id: match[3]!,
    })
  }
  return tokens
}

const MENTION_ROUTES: Record<MentionToken['kind'], string> = {
  char: '/characters',
  npc: '/npcs',
  location: '/locations',
  feature: '/features',
  org: '/organizations',
}

const MENTION_COLORS: Record<MentionToken['kind'], string> = {
  char: 'color: #60a5fa',       // blue
  npc: 'color: #fbbf24',        // amber
  location: 'color: #4ade80',   // green
  feature: 'color: #c084fc',    // purple
  org: 'color: #fb7185',        // rose
}

const MENTION_PREFIXES: Record<MentionToken['kind'], string> = {
  char: '@',
  npc: '@',
  location: '#',
  feature: '#',
  org: '¦',
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
    const route = `${MENTION_ROUTES[kind as MentionToken['kind']] || '/'}/${id}`
    const color = MENTION_COLORS[kind as MentionToken['kind']] || 'color: #60a5fa'
    const prefix = MENTION_PREFIXES[kind as MentionToken['kind']] || '@'
    const escapedName = escapeHtml(name)
    return `<a href="${route}" class="mention-link" style="${color}; text-decoration: none; font-weight: 500;" data-mention-kind="${kind}" data-mention-id="${id}">${prefix}${escapedName}</a>`
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

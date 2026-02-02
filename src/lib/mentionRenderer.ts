/**
 * Mention renderer utility.
 * Parses mention tokens like @[Display Name](char:id) and @[Display Name](npc:id)
 * and converts them to HTML with clickable links.
 */

export interface MentionToken {
  name: string
  kind: 'char' | 'npc'
  id: string
}

const MENTION_REGEX = /@\[([^\]]+)\]\((char|npc):([^)]+)\)/g

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
      kind: match[2] as 'char' | 'npc',
      id: match[3]!,
    })
  }
  return tokens
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
    const route = kind === 'char' ? `/characters/${id}` : `/npcs/${id}`
    const color = kind === 'char' ? 'color: #60a5fa' : 'color: #fbbf24'
    const escapedName = escapeHtml(name)
    return `<a href="${route}" class="mention-link" style="${color}; text-decoration: none; font-weight: 500;" data-mention-kind="${kind}" data-mention-id="${id}">@${escapedName}</a>`
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

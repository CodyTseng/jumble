import customEmojiService from '@/services/custom-emoji.service'
import { emojis, shortcodeToEmoji } from '@tiptap/extension-emoji'
import { JSONContent } from '@tiptap/react'
import { normalizeNostrReferences } from './nostr-references'

export function parseEditorJsonToText(node?: JSONContent, options?: { trim?: boolean }) {
  const text = _parseEditorJsonToText(node)
  const normalized = normalizeNostrReferences(text)

  // Trimming the outer whitespace is right when producing the final note body,
  // but the clipboard serializer reuses this and must preserve a copied
  // selection's leading/trailing spaces — those callers pass { trim: false }.
  return options?.trim === false ? normalized : normalized.trim()
}

function _parseEditorJsonToText(node?: JSONContent): string {
  if (!node) return ''

  if (typeof node === 'string') return node

  if (node.type === 'text') {
    return node.text || ''
  }

  if (node.type === 'hardBreak') {
    return '\n'
  }

  if (Array.isArray(node.content)) {
    return (
      node.content.map(_parseEditorJsonToText).join('') + (node.type === 'paragraph' ? '\n' : '')
    )
  }

  switch (node.type) {
    case 'paragraph':
      return '\n'
    case 'mention':
      return node.attrs ? `nostr:${node.attrs.id}` : ''
    case 'emoji':
      return parseEmojiNodeName(node.attrs?.name)
    default:
      return ''
  }
}

function parseEmojiNodeName(name?: string): string {
  if (!name) return ''
  if (customEmojiService.getEmojiById(name)) {
    return `:${name}:`
  }
  const emoji = shortcodeToEmoji(name, emojis)
  return emoji ? (emoji.emoji ?? '') : ''
}

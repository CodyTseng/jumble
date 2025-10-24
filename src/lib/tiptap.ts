import customEmojiService from '@/services/custom-emoji.service'
import { emojis, shortcodeToEmoji } from '@tiptap/extension-emoji'
import { JSONContent } from '@tiptap/react'
import { nip19 } from 'nostr-tools'

export function parseEditorJsonToText(node?: JSONContent) {
  const text = _parseEditorJsonToText(node).trim()
  const regex = /(?:^|\s|@)(?:nostr:)?(nevent|naddr|nprofile|npub)1[a-zA-Z0-9]+/g

  return text.replace(regex, (match) => {
    const leadingWhitespaceMatch = match.match(/^\s+/)
    const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : ''
    const trimmed = match.slice(leadingWhitespace.length)
    const normalized = trimmed.replace(/^@/, '').replace(/^nostr:/, '')

    try {
      nip19.decode(normalized)
      return `${leadingWhitespace}nostr:${normalized}`
    } catch {
      return match
    }
  })
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
  if (customEmojiService.isCustomEmojiId(name)) {
    return `:${name}:`
  }
  const emoji = shortcodeToEmoji(name, emojis)
  return emoji ? (emoji.emoji ?? '') : ''
}

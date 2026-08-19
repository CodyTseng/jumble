import customEmojiService from '@/services/custom-emoji.service'
import { emojis, shortcodeToEmoji } from '@tiptap/extension-emoji'
import { JSONContent } from '@tiptap/react'
import { nip19 } from 'nostr-tools'

export function parseEditorJsonToText(node?: JSONContent, options?: { trim?: boolean }) {
  const text = _parseEditorJsonToText(node)
  const regex = /(^|\s+|@)(nostr:)?(nevent|naddr|nprofile|npub)1[a-zA-Z0-9]+/g

  const normalized = text.replace(regex, (...args) => {
    const [match, leadingWhitespace] = args as [string, string]
    const offset = args[args.length - 2] as number
    const full = args[args.length - 1] as string

    // A bech32 id that runs straight into a hostname or a path belongs to a URL
    // (e.g. npub1….blossom.band/image.png), not to a mention. Prefixing it there
    // breaks the link, so leave it alone.
    if (/^(?:\.[a-zA-Z0-9-]|\/)/.test(full.slice(offset + match.length))) {
      return match
    }

    let bech32 = match.trim()
    const whitespace = leadingWhitespace || ''

    if (bech32.startsWith('@nostr:')) {
      bech32 = bech32.slice(7)
    } else if (bech32.startsWith('@')) {
      bech32 = bech32.slice(1)
    } else if (bech32.startsWith('nostr:')) {
      bech32 = bech32.slice(6)
    }

    try {
      nip19.decode(bech32)
      return `${whitespace}nostr:${bech32}`
    } catch {
      return match
    }
  })

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

import { EMOJI_SHORT_CODE_REGEX, URL_REGEX } from '@/constants'
import customEmojiService from '@/services/custom-emoji.service'
import mediaUpload from '@/services/media-upload.service'
import { TEmoji } from '@/types'
import { TPostDraftUnsigned } from '@/types/post-draft'
import { Event } from 'nostr-tools'
import { transformCustomEmojisInContent } from './draft-event'

export function collectImetaTagsForUrls(text: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const matches = text.matchAll(URL_REGEX)
  for (const m of matches) {
    const url = m[0]
    if (result[url]) continue
    const tag = mediaUpload.getImetaTagByUrl(url)
    if (tag) result[url] = tag
  }
  return result
}

export function collectCustomEmojisInText(text: string): Record<string, TEmoji> {
  const result: Record<string, TEmoji> = {}
  const matches = text.match(EMOJI_SHORT_CODE_REGEX)
  matches?.forEach((m) => {
    const id = m.slice(1, -1)
    if (result[id]) return
    const emoji = customEmojiService.getEmojiById(id)
    if (emoji) result[id] = emoji
  })
  return result
}

export function rehydrateDraftRuntime(draft: TPostDraftUnsigned) {
  for (const [url, tag] of Object.entries(draft.imetaTags ?? {})) {
    if (!mediaUpload.getImetaTagByUrl(url)) {
      mediaUpload.registerImetaTag(url, tag)
    }
  }
  for (const [id, emoji] of Object.entries(draft.customEmojis ?? {})) {
    if (!customEmojiService.getEmojiById(id)) {
      customEmojiService.registerExternalEmoji(emoji)
    }
  }
}

/**
 * Synchronously build a fake (unsigned) event from a draft's stored fields so it
 * can be rendered by ContentPreview. Used as a fallback for drafts saved before
 * previewEvent was persisted: resolves custom emojis (preferring the draft's own
 * snapshot) and attaches imeta tags so media/emoji render correctly.
 */
export function buildPreviewEvent(draft: TPostDraftUnsigned): Event | undefined {
  if (!draft.text.trim()) return undefined
  for (const emoji of Object.values(draft.customEmojis ?? {})) {
    customEmojiService.registerExternalEmoji(emoji)
  }
  const { content, emojiTags } = transformCustomEmojisInContent(draft.text)
  const tags = [...emojiTags, ...Object.values(draft.imetaTags ?? {})]
  return {
    id: draft.id,
    pubkey: draft.pubkey,
    created_at: Math.floor(draft.updatedAt / 1000),
    kind: 1,
    tags,
    content,
    sig: ''
  }
}

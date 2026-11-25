import { EMBEDDED_EVENT_REGEX, ExtendedKind, SUPPORTED_KINDS } from '@/constants'
import { TNotificationFilter } from '@/types'
import { kinds, nip19, NostrEvent } from 'nostr-tools'
import {
  getEmbeddedPubkeys,
  getEventAuthorPubkey,
  getEventKey,
  getParentStuff,
  getParentTag,
  getReplaceableCoordinate,
  isMentioningMutedUsers
} from './event-core'
import { tagNameEquals } from './tag'

export const NOTIFICATION_KINDS = [
  kinds.ShortTextNote,
  kinds.Repost,
  kinds.GenericRepost,
  kinds.Reaction,
  kinds.Zap,
  kinds.Highlights,
  ExtendedKind.COMMENT,
  ExtendedKind.POLL_RESPONSE,
  ExtendedKind.VOICE_COMMENT,
  ExtendedKind.POLL
]

export function getNotificationFilterType(
  event: NostrEvent,
  pubkey?: string | null
): TNotificationFilter | null {
  if (event.kind === kinds.Reaction) return 'likes'
  if (event.kind === kinds.Repost || event.kind === kinds.GenericRepost) return 'reposts'
  if (event.kind === kinds.Zap) return 'zaps'
  if (event.kind === kinds.Highlights) return 'highlights'
  if (event.kind === ExtendedKind.POLL_RESPONSE) return 'pollResponses'
  if (event.kind === ExtendedKind.POLL) return 'mentions'

  if (
    ![kinds.ShortTextNote, ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT].includes(event.kind)
  ) {
    return null
  }

  if (pubkey && getEmbeddedPubkeys(event).includes(pubkey)) {
    return 'mentions'
  }

  const { parentEventId, parentExternalContent } = getParentStuff(event)
  if (parentEventId || parentExternalContent) return 'replies'

  return event.kind === kinds.ShortTextNote ? 'quotes' : 'replies'
}

export function isForMutedNote(event: NostrEvent, mutedNoteKeys: ReadonlySet<string>): boolean {
  if (!mutedNoteKeys.size) return false
  if (mutedNoteKeys.has(getEventKey(event))) return true

  switch (event.kind) {
    case kinds.Reaction:
    case kinds.Repost:
    case kinds.GenericRepost:
    case kinds.Zap:
    case kinds.Highlights:
    case ExtendedKind.POLL_RESPONSE: {
      const eTag =
        event.kind === ExtendedKind.POLL_RESPONSE
          ? event.tags.find(tagNameEquals('e'))
          : event.tags.findLast(tagNameEquals('e'))
      const aTag = event.tags.findLast(tagNameEquals('a'))
      if (mutedNoteKeys.has(eTag?.[1] ?? '') || mutedNoteKeys.has(aTag?.[1] ?? '')) return true
      if (event.kind === kinds.Highlights) {
        return event.tags.some(([name, key]) => name === 'q' && mutedNoteKeys.has(key))
      }
      return false
    }
    case kinds.ShortTextNote:
    case ExtendedKind.COMMENT:
    case ExtendedKind.VOICE_COMMENT:
    case ExtendedKind.POLL: {
      // Match the direct parent. A root tag on a reply to a different note
      // does not make that reply an interaction with the muted note.
      const parent = getParentTag(event)
      if (parent && parent.type !== 'i' && mutedNoteKeys.has(parent.tag[1])) return true
      if (
        event.tags.some(
          ([name, key, , marker]) =>
            (name === 'q' || ((name === 'e' || name === 'a') && marker === 'mention')) &&
            mutedNoteKeys.has(key)
        )
      ) {
        return true
      }
      // Older clients can quote a note in the content without a q tag.
      return (event.content.match(EMBEDDED_EVENT_REGEX) ?? []).some((reference) => {
        try {
          const { type, data } = nip19.decode(reference.slice('nostr:'.length))
          if (type === 'note') return mutedNoteKeys.has(data)
          if (type === 'nevent') return mutedNoteKeys.has(data.id)
          if (type === 'naddr') {
            return mutedNoteKeys.has(
              getReplaceableCoordinate(data.kind, data.pubkey, data.identifier)
            )
          }
        } catch {
          // Ignore invalid references.
        }
        return false
      })
    }
    default:
      return false
  }
}

export async function notificationFilter(
  event: NostrEvent,
  {
    pubkey,
    mutePubkeySet,
    mutedNoteKeys,
    hideContentMentioningMutedUsers,
    meetsMinTrustScore,
    validateZapReceipt
  }: {
    pubkey?: string | null
    mutePubkeySet: Set<string>
    mutedNoteKeys?: ReadonlySet<string>
    hideContentMentioningMutedUsers?: boolean
    meetsMinTrustScore: (pubkey: string) => Promise<boolean>
    validateZapReceipt: (event: NostrEvent) => Promise<boolean>
  }
): Promise<boolean> {
  if (mutedNoteKeys && isForMutedNote(event, mutedNoteKeys)) return false

  // Zap receipts must be validated before trusting their embedded sender data.
  // Keeping this in the shared filter makes the list, unread badge/count and
  // native system notifications agree on which zaps actually exist.
  if (event.kind === kinds.Zap && !(await validateZapReceipt(event))) {
    return false
  }

  const authorPubkey = getEventAuthorPubkey(event)
  if (
    mutePubkeySet.has(authorPubkey) ||
    (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) ||
    !(await meetsMinTrustScore(authorPubkey))
  ) {
    return false
  }

  if (event.kind === kinds.Reaction) {
    if (pubkey) {
      const targetPubkey = event.tags.findLast(tagNameEquals('p'))?.[1]
      if (targetPubkey !== pubkey) return false
    }

    // NIP-25 reactions to kind 1 may omit the k tag. Other target kinds
    // should declare it so clients can decide whether they support the target.
    const targetKindTag = event.tags.findLast(tagNameEquals('k'))
    const targetKind = targetKindTag ? Number(targetKindTag[1]) : kinds.ShortTextNote
    if (!Number.isInteger(targetKind) || !SUPPORTED_KINDS.includes(targetKind)) return false
  }

  return true
}

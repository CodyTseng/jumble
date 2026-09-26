import { ExtendedKind, SUPPORTED_KINDS } from '@/constants'
import { TNotificationFilter } from '@/types'
import { kinds, NostrEvent } from 'nostr-tools'
import {
  getEmbeddedPubkeys,
  getEventAuthorPubkey,
  getParentStuff,
  isMentioningMutedUsers
} from './event'
import { tagNameEquals } from './tag'

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

export async function notificationFilter(
  event: NostrEvent,
  {
    pubkey,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    meetsMinTrustScore,
    validateZapReceipt
  }: {
    pubkey?: string | null
    mutePubkeySet: Set<string>
    hideContentMentioningMutedUsers?: boolean
    meetsMinTrustScore: (pubkey: string) => Promise<boolean>
    validateZapReceipt: (event: NostrEvent) => Promise<boolean>
  }
): Promise<boolean> {
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

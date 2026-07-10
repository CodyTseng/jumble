import { kinds, NostrEvent } from 'nostr-tools'
import { getEventAuthorPubkey, isMentioningMutedUsers } from './event'
import { tagNameEquals } from './tag'

export async function notificationFilter(
  event: NostrEvent,
  {
    pubkey,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    meetsMinTrustScore
  }: {
    pubkey?: string | null
    mutePubkeySet: Set<string>
    hideContentMentioningMutedUsers?: boolean
    meetsMinTrustScore: (pubkey: string) => Promise<boolean>
  }
): Promise<boolean> {
  const authorPubkey = getEventAuthorPubkey(event)
  if (
    mutePubkeySet.has(authorPubkey) ||
    (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) ||
    !(await meetsMinTrustScore(authorPubkey))
  ) {
    return false
  }

  if (pubkey && event.kind === kinds.Reaction) {
    const targetPubkey = event.tags.findLast(tagNameEquals('p'))?.[1]
    if (targetPubkey !== pubkey) return false
  }

  return true
}

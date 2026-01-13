import { kinds, NostrEvent } from 'nostr-tools'
import { isMentioningMutedUsers } from './event'
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
    meetsMinTrustScore: (pubkey: string, minScore?: number) => Promise<boolean>
  }
): Promise<boolean> {
  if (
    mutePubkeySet.has(event.pubkey) ||
    (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) ||
    !(await meetsMinTrustScore(event.pubkey))
  ) {
    return false
  }

  if (pubkey && event.kind === kinds.Reaction) {
    const targetPubkey = event.tags.findLast(tagNameEquals('p'))?.[1]
    if (targetPubkey !== pubkey) return false
  }

  return true
}

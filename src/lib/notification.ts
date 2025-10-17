import { kinds, NostrEvent } from 'nostr-tools'
import { isMentioningMutedUsers } from './event'
import { tagNameEquals } from './tag'

export function notificationFilter(
  event: NostrEvent,
  {
    pubkey,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    hideNotificationsFromMutedUsers,
    hideUntrustedNotifications,
    isUserTrusted
  }: {
    pubkey?: string | null
    mutePubkeySet: Set<string>
    hideContentMentioningMutedUsers?: boolean
    hideNotificationsFromMutedUsers?: boolean
    hideUntrustedNotifications?: boolean
    isUserTrusted: (pubkey: string) => boolean
  }
): boolean {
  if (
    (hideNotificationsFromMutedUsers && mutePubkeySet.has(event.pubkey)) ||
    (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) ||
    (hideUntrustedNotifications && !isUserTrusted(event.pubkey))
  ) {
    return false
  }

  if (pubkey && event.kind === kinds.Reaction) {
    const targetPubkey = event.tags.findLast(tagNameEquals('p'))?.[1]
    if (targetPubkey !== pubkey) return false
  }

  return true
}

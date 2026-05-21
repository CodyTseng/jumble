import { Event } from 'nostr-tools'

export function isFollowedAuthor(
  event: Event,
  followedPubkeys: ReadonlySet<string> | undefined
) {
  return followedPubkeys?.has(event.pubkey) ?? false
}

export function filterFollowedAuthors(events: Event[], followedPubkeys: ReadonlySet<string>) {
  if (followedPubkeys.size === 0) {
    return events
  }
  return events.filter((event) => !isFollowedAuthor(event, followedPubkeys))
}

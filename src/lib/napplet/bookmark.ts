import type { Event } from 'nostr-tools'

export function isNappletBookmarked(event: Event, bookmarks: Event | null) {
  const key =
    event.kind === 5129
      ? event.id
      : `${event.kind}:${event.pubkey}:${event.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''}`
  const type = event.kind === 5129 ? 'e' : 'a'
  return bookmarks?.tags.some((tag) => tag[0] === type && tag[1] === key) ?? false
}

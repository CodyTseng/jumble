import { Event } from 'nostr-tools'

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

import { Event, kinds } from 'nostr-tools'

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  return event.kind === kinds.ShortTextNote && event.tags.some(([tagName]) => tagName === 'e')
}

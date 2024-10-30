import { Event, kinds } from 'nostr-tools'

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  return (
    event.kind === kinds.ShortTextNote &&
    event.tags.some(([tagName, , , type]) => tagName === 'e' && ['root', 'reply'].includes(type))
  )
}

export function getParentEventId(event: Event) {
  return event.tags.find(([tagName, , , type]) => tagName === 'e' && type === 'reply')?.[1]
}

export function getRootEventId(event: Event) {
  return event.tags.find(([tagName, , , type]) => tagName === 'e' && type === 'root')?.[1]
}

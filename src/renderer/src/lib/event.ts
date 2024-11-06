import { Event, kinds } from 'nostr-tools'
import { replyETag, rootETag, tagNameEquals } from './tag'

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  return event.kind === kinds.ShortTextNote && event.tags.some(tagNameEquals('e'))
}

export function getParentEventId(event: Event) {
  return event.tags.find(replyETag)?.[1]
}

export function getRootEventId(event: Event) {
  return event.tags.find(rootETag)?.[1]
}

export function isReplaceable(kind: number) {
  return kinds.isReplaceableKind(kind) || kinds.isParameterizedReplaceableKind(kind)
}

export function getEventCoordinate(event: Event) {
  const d = event.tags.find(tagNameEquals('d'))?.[1]
  return d ? `${event.kind}:${event.pubkey}:${d}` : `${event.kind}:${event.pubkey}`
}

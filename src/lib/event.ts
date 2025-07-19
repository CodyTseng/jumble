import { ExtendedKind } from '@/constants'
import client from '@/services/client.service'
import { TImageInfo } from '@/types'
import { LRUCache } from 'lru-cache'
import { Event, kinds, nip19 } from 'nostr-tools'
import {
  getImageInfoFromImetaTag,
  generateBech32IdFromATag,
  generateBech32IdFromETag,
  tagNameEquals
} from './tag'

const EVENT_EMBEDDED_NOTES_CACHE = new LRUCache<string, string[]>({ max: 10000 })
const EVENT_IS_REPLY_NOTE_CACHE = new LRUCache<string, boolean>({ max: 10000 })

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  if (![kinds.ShortTextNote, ExtendedKind.COMMENT].includes(event.kind)) return false

  const cache = EVENT_IS_REPLY_NOTE_CACHE.get(event.id)
  if (cache !== undefined) return cache

  const isReply = !!getParentETag(event) || !!getParentATag(event)
  EVENT_IS_REPLY_NOTE_CACHE.set(event.id, isReply)
  return isReply
}

export function isReplaceableEvent(kind: number) {
  return kinds.isReplaceableKind(kind) || kinds.isAddressableKind(kind)
}

export function isPictureEvent(event: Event) {
  return event.kind === ExtendedKind.PICTURE
}

export function isProtectedEvent(event: Event) {
  return event.tags.some(([tagName]) => tagName === '-')
}

export function getParentETag(event?: Event) {
  if (!event || ![kinds.ShortTextNote, ExtendedKind.COMMENT].includes(event.kind)) return undefined

  if (event.kind === ExtendedKind.COMMENT) {
    return event.tags.find(tagNameEquals('e')) ?? event.tags.find(tagNameEquals('E'))
  }

  let tag = event.tags.find(([tagName, , , marker]) => {
    return tagName === 'e' && marker === 'reply'
  })
  if (!tag) {
    const embeddedEventIds = getEmbeddedNoteBech32Ids(event)
    tag = event.tags.findLast(
      ([tagName, tagValue]) => tagName === 'e' && !!tagValue && !embeddedEventIds.includes(tagValue)
    )
  }
  return tag
}

export function getParentATag(event?: Event) {
  if (!event || ![kinds.ShortTextNote, ExtendedKind.COMMENT].includes(event.kind)) return undefined

  return event.tags.find(tagNameEquals('a')) ?? event.tags.find(tagNameEquals('A'))
}

export function getParentEventHexId(event?: Event) {
  const tag = getParentETag(event)
  return tag?.[1]
}

export function getParentBech32Id(event?: Event) {
  const eTag = getParentETag(event)
  if (!eTag) {
    const aTag = getParentATag(event)
    if (!aTag) return undefined

    return generateBech32IdFromATag(aTag)
  }

  return generateBech32IdFromETag(eTag)
}

export function getRootETag(event?: Event) {
  if (!event || ![kinds.ShortTextNote, ExtendedKind.COMMENT].includes(event.kind)) return undefined

  if (event.kind === ExtendedKind.COMMENT) {
    return event.tags.find(tagNameEquals('E'))
  }

  let tag = event.tags.find(([tagName, , , marker]) => {
    return tagName === 'e' && marker === 'root'
  })
  if (!tag) {
    const embeddedEventIds = getEmbeddedNoteBech32Ids(event)
    tag = event.tags.find(
      ([tagName, tagValue]) => tagName === 'e' && !!tagValue && !embeddedEventIds.includes(tagValue)
    )
  }
  return tag
}

export function getRootATag(event?: Event) {
  if (!event || event.kind !== ExtendedKind.COMMENT) return undefined

  return event.tags.find(tagNameEquals('A'))
}

export function getRootEventHexId(event?: Event) {
  const tag = getRootETag(event)
  return tag?.[1]
}

export function getRootBech32Id(event?: Event) {
  const eTag = getRootETag(event)
  if (!eTag) {
    const aTag = getRootATag(event)
    if (!aTag) return undefined

    return generateBech32IdFromATag(aTag)
  }

  return generateBech32IdFromETag(eTag)
}

export function getReplaceableEventCoordinate(event: Event) {
  const d = event.tags.find(tagNameEquals('d'))?.[1]
  return d ? `${event.kind}:${event.pubkey}:${d}` : `${event.kind}:${event.pubkey}`
}

export function getNoteBech32Id(event: Event) {
  const hints = client.getEventHints(event.id).slice(0, 2)
  if (isReplaceableEvent(event.kind)) {
    const identifier = event.tags.find(tagNameEquals('d'))?.[1] ?? ''
    return nip19.naddrEncode({ pubkey: event.pubkey, kind: event.kind, identifier, relays: hints })
  }
  return nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind, relays: hints })
}

export function getUsingClient(event: Event) {
  return event.tags.find(tagNameEquals('client'))?.[1]
}

export function getImageInfosFromEvent(event: Event) {
  const images: TImageInfo[] = []
  event.tags.forEach((tag) => {
    const imageInfo = getImageInfoFromImetaTag(tag, event.pubkey)
    if (imageInfo) {
      images.push(imageInfo)
    }
  })
  return images
}

export function getEmbeddedNoteBech32Ids(event: Event) {
  const cache = EVENT_EMBEDDED_NOTES_CACHE.get(event.id)
  if (cache) return cache

  const embeddedNoteBech32Ids: string[] = []
  const embeddedNoteRegex = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g
  ;(event.content.match(embeddedNoteRegex) || []).forEach((note) => {
    try {
      const { type, data } = nip19.decode(note.split(':')[1])
      if (type === 'nevent') {
        embeddedNoteBech32Ids.push(data.id)
      } else if (type === 'note') {
        embeddedNoteBech32Ids.push(data)
      }
    } catch {
      // ignore
    }
  })
  EVENT_EMBEDDED_NOTES_CACHE.set(event.id, embeddedNoteBech32Ids)
  return embeddedNoteBech32Ids
}

export function getLatestEvent(events: Event[]) {
  return events.sort((a, b) => b.created_at - a.created_at)[0]
}

export function getReplaceableEventIdentifier(event: Event) {
  return event.tags.find(tagNameEquals('d'))?.[1] ?? ''
}

export function createFakeEvent(event: Partial<Event>): Event {
  return {
    id: '',
    kind: 1,
    pubkey: '',
    content: '',
    created_at: 0,
    tags: [],
    sig: '',
    ...event
  }
}

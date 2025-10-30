import { EMBEDDED_MENTION_REGEX, ExtendedKind } from '@/constants'
import client from '@/services/client.service'
import { TImetaInfo } from '@/types'
import { LRUCache } from 'lru-cache'
import { Event, kinds, nip19, UnsignedEvent } from 'nostr-tools'
import { fastEventHash, getPow } from 'nostr-tools/nip13'
import {
  generateBech32IdFromATag,
  generateBech32IdFromETag,
  getImetaInfoFromImetaTag,
  tagNameEquals
} from './tag'

const EVENT_EMBEDDED_NOTES_CACHE = new LRUCache<string, string[]>({ max: 10000 })
const EVENT_EMBEDDED_PUBKEYS_CACHE = new LRUCache<string, string[]>({ max: 10000 })
const EVENT_IS_REPLY_NOTE_CACHE = new LRUCache<string, boolean>({ max: 10000 })

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  if ([ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT].includes(event.kind)) {
    return true
  }
  if (event.kind !== kinds.ShortTextNote) return false

  const cache = EVENT_IS_REPLY_NOTE_CACHE.get(event.id)
  if (cache !== undefined) return cache

  const isReply = !!getParentTag(event)
  EVENT_IS_REPLY_NOTE_CACHE.set(event.id, isReply)
  return isReply
}

export function isReplaceableEvent(kind: number) {
  if (isNaN(kind)) return false
  return kinds.isReplaceableKind(kind) || kinds.isAddressableKind(kind)
}

export function isPictureEvent(event: Event) {
  return event.kind === ExtendedKind.PICTURE
}

export function isProtectedEvent(event: Event) {
  return event.tags.some(([tagName]) => tagName === '-')
}

export function isMentioningMutedUsers(event: Event, mutePubkeySet: Set<string>) {
  for (const [tagName, pubkey] of event.tags) {
    if (tagName === 'p' && mutePubkeySet.has(pubkey)) {
      return true
    }
  }
  return false
}

export function getParentETag(event?: Event) {
  if (!event) return undefined

  if (event.kind === ExtendedKind.COMMENT || event.kind === ExtendedKind.VOICE_COMMENT) {
    return event.tags.find(tagNameEquals('e')) ?? event.tags.find(tagNameEquals('E'))
  }

  if (event.kind !== kinds.ShortTextNote) return undefined

  let tag = event.tags.find(([tagName, , , marker]) => {
    return tagName === 'e' && marker === 'reply'
  })
  if (!tag) {
    const embeddedEventIds = getEmbeddedNoteBech32Ids(event)
    tag = event.tags.findLast(
      ([tagName, tagValue, , marker]) =>
        tagName === 'e' &&
        !!tagValue &&
        marker !== 'mention' &&
        !embeddedEventIds.includes(tagValue)
    )
  }
  return tag
}

export function getParentATag(event?: Event) {
  if (
    !event ||
    ![kinds.ShortTextNote, ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT].includes(event.kind)
  ) {
    return undefined
  }

  return event.tags.find(tagNameEquals('a')) ?? event.tags.find(tagNameEquals('A'))
}

export function getParentEventHexId(event?: Event) {
  const tag = getParentETag(event)
  return tag?.[1]
}

export function getParentTag(event?: Event): { type: 'e' | 'a'; tag: string[] } | undefined {
  if (!event) return undefined

  if (event.kind === kinds.ShortTextNote) {
    const tag = getParentETag(event)
    return tag ? { type: 'e', tag } : undefined
  }

  // NIP-22
  const parentKindStr = event.tags.find(tagNameEquals('k'))?.[1]
  if (parentKindStr && isReplaceableEvent(parseInt(parentKindStr))) {
    const tag = getParentATag(event)
    return tag ? { type: 'a', tag } : undefined
  }

  const tag = getParentETag(event)
  return tag ? { type: 'e', tag } : undefined
}

export function getParentBech32Id(event?: Event) {
  const parentTag = getParentTag(event)
  if (!parentTag) return undefined

  return parentTag.type === 'e'
    ? generateBech32IdFromETag(parentTag.tag)
    : generateBech32IdFromATag(parentTag.tag)
}

export function getRootETag(event?: Event) {
  if (!event) return undefined

  if (event.kind === ExtendedKind.COMMENT || event.kind === ExtendedKind.VOICE_COMMENT) {
    return event.tags.find(tagNameEquals('E'))
  }

  if (event.kind !== kinds.ShortTextNote) return undefined

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
  if (
    !event ||
    ![kinds.ShortTextNote, ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT].includes(event.kind)
  ) {
    return undefined
  }

  return event.tags.find(tagNameEquals('A'))
}

export function getRootEventHexId(event?: Event) {
  const tag = getRootETag(event)
  return tag?.[1]
}

export function getRootTag(event?: Event): { type: 'e' | 'a'; tag: string[] } | undefined {
  if (!event) return undefined

  if (event.kind === kinds.ShortTextNote) {
    const tag = getRootETag(event)
    return tag ? { type: 'e', tag } : undefined
  }

  // NIP-22
  const rootKindStr = event.tags.find(tagNameEquals('K'))?.[1]
  if (rootKindStr && isReplaceableEvent(parseInt(rootKindStr))) {
    const tag = getRootATag(event)
    return tag ? { type: 'a', tag } : undefined
  }

  const tag = getRootETag(event)
  return tag ? { type: 'e', tag } : undefined
}

export function getRootBech32Id(event?: Event) {
  const rootTag = getRootTag(event)
  if (!rootTag) return undefined

  return rootTag.type === 'e'
    ? generateBech32IdFromETag(rootTag.tag)
    : generateBech32IdFromATag(rootTag.tag)
}

// For internal identification of events
export function getEventKey(event: Event) {
  return isReplaceableEvent(event.kind) ? getReplaceableCoordinateFromEvent(event) : event.id
}

// Only used for e, E, a, A tags
export function getEventKeyFromTag([, tagValue]: (string | undefined)[]) {
  return tagValue
}

export function getReplaceableCoordinate(kind: number, pubkey: string, d: string = '') {
  return `${kind}:${pubkey}:${d}`
}

export function getReplaceableCoordinateFromEvent(event: Event) {
  const d = event.tags.find(tagNameEquals('d'))?.[1]
  return getReplaceableCoordinate(event.kind, event.pubkey, d)
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

export function getImetaInfosFromEvent(event: Event) {
  const imeta: TImetaInfo[] = []
  event.tags.forEach((tag) => {
    const imageInfo = getImetaInfoFromImetaTag(tag, event.pubkey)
    if (imageInfo) {
      imeta.push(imageInfo)
    }
  })
  return imeta
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

export function getEmbeddedPubkeys(event: Event) {
  const cache = EVENT_EMBEDDED_PUBKEYS_CACHE.get(event.id)
  if (cache) return cache

  const embeddedPubkeySet = new Set<string>()
  ;(event.content.match(EMBEDDED_MENTION_REGEX) || []).forEach((mention) => {
    try {
      const { type, data } = nip19.decode(mention.split(':')[1])
      if (type === 'npub') {
        embeddedPubkeySet.add(data)
      } else if (type === 'nprofile') {
        embeddedPubkeySet.add(data.pubkey)
      }
    } catch {
      // ignore
    }
  })
  const embeddedPubkeys = Array.from(embeddedPubkeySet)
  EVENT_EMBEDDED_PUBKEYS_CACHE.set(event.id, embeddedPubkeys)
  return embeddedPubkeys
}

export function getLatestEvent(events: Event[]): Event | undefined {
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

export async function minePow(
  unsigned: UnsignedEvent,
  difficulty: number
): Promise<Omit<Event, 'sig'>> {
  let count = 0

  const event = unsigned as Omit<Event, 'sig'>
  const tag = ['nonce', count.toString(), difficulty.toString()]

  event.tags.push(tag)

  return new Promise((resolve) => {
    const mine = () => {
      let iterations = 0

      while (iterations < 1000) {
        const now = Math.floor(new Date().getTime() / 1000)

        if (now !== event.created_at) {
          count = 0
          event.created_at = now
        }

        tag[1] = (++count).toString()
        event.id = fastEventHash(event)

        if (getPow(event.id) >= difficulty) {
          resolve(event)
          return
        }

        iterations++
      }

      setTimeout(mine, 0)
    }

    mine()
  })
}

// Legacy compare function for sorting compatibility
// If return 0, it means the two events are equal.
// If return a negative number, it means `b` should be retained, and `a` should be discarded.
// If return a positive number, it means `a` should be retained, and `b` should be discarded.
export function compareEvents(a: Event, b: Event): number {
  if (a.created_at !== b.created_at) {
    return a.created_at - b.created_at
  }
  // In case of replaceable events with the same timestamp, the event with the lowest id (first in lexical order) should be retained, and the other discarded.
  if (a.id !== b.id) {
    return a.id < b.id ? 1 : -1
  }
  return 0
}

// Returns the event that should be retained when comparing two events
export function getRetainedEvent(a: Event, b: Event): Event {
  if (compareEvents(a, b) > 0) {
    return a
  }
  return b
}

import client from '@/services/client.service'
import { Event, kinds, nip19 } from 'nostr-tools'
import { isReplyETag, isRootETag, tagNameEquals } from './tag'

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  if (event.kind !== kinds.ShortTextNote) return false

  let hasETag = false
  let hasMarker = false
  for (const [tagName, , , marker] of event.tags) {
    if (tagName !== 'e') continue
    hasETag = true

    if (!marker) continue
    hasMarker = true

    if (['root', 'reply'].includes(marker)) return true
  }
  return hasETag && !hasMarker
}

export function getParentEventId(event?: Event) {
  return event?.tags.find(isReplyETag)?.[1]
}

export function getRootEventId(event?: Event) {
  return event?.tags.find(isRootETag)?.[1]
}

export function isReplaceable(kind: number) {
  return kinds.isReplaceableKind(kind) || kinds.isParameterizedReplaceableKind(kind)
}

export function getEventCoordinate(event: Event) {
  const d = event.tags.find(tagNameEquals('d'))?.[1]
  return d ? `${event.kind}:${event.pubkey}:${d}` : `${event.kind}:${event.pubkey}`
}

export function getSharableEventId(event: Event) {
  if (isReplaceable(event.kind)) {
    const identifier = event.tags.find(tagNameEquals('d'))?.[1] ?? ''
    return nip19.naddrEncode({ pubkey: event.pubkey, kind: event.kind, identifier })
  }
  return nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind })
}

export function getUsingClient(event: Event) {
  return event.tags.find(tagNameEquals('client'))?.[1]
}

export async function extractMentions(content: string, parentEvent?: Event) {
  const pubkeySet = new Set<string>()
  const relatedEventIdSet = new Set<string>()
  const quoteEventIdSet = new Set<string>()
  let rootEventId: string | undefined
  let parentEventId: string | undefined
  const matches = content.match(
    /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g
  )

  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nprofile') {
        pubkeySet.add(data.pubkey)
      } else if (type === 'npub') {
        pubkeySet.add(data)
      } else if (['nevent', 'note', 'naddr'].includes(type)) {
        const event = await client.fetchEvent(id)
        if (event) {
          pubkeySet.add(event.pubkey)
          quoteEventIdSet.add(event.id)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (parentEvent) {
    relatedEventIdSet.add(parentEvent.id)
    pubkeySet.add(parentEvent.pubkey)
    parentEvent.tags.forEach((tag) => {
      if (tagNameEquals('p')(tag)) {
        pubkeySet.add(tag[1])
      } else if (isRootETag(tag)) {
        rootEventId = tag[1]
      } else if (tagNameEquals('e')(tag)) {
        relatedEventIdSet.add(tag[1])
      }
    })
    if (rootEventId || isReplyNoteEvent(parentEvent)) {
      parentEventId = parentEvent.id
    } else {
      rootEventId = parentEvent.id
    }
  }

  if (rootEventId) relatedEventIdSet.delete(rootEventId)
  if (parentEventId) relatedEventIdSet.delete(parentEventId)

  return {
    pubkeys: Array.from(pubkeySet),
    otherRelatedEventIds: Array.from(relatedEventIdSet),
    quoteEventIds: Array.from(quoteEventIdSet),
    rootEventId,
    parentEventId
  }
}

export function extractHashtags(content: string) {
  const hashtags: string[] = []
  const matches = content.match(/#[\p{L}\p{N}\p{M}]+/gu)
  matches?.forEach((m) => {
    const hashtag = m.slice(1).toLowerCase()
    if (hashtag) {
      hashtags.push(hashtag)
    }
  })
  return hashtags
}

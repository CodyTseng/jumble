import client from '@renderer/services/client.service'
import { Event, kinds, nip19 } from 'nostr-tools'
import { replyETag, rootETag, tagNameEquals } from './tag'

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  return event.kind === kinds.ShortTextNote && event.tags.some(rootETag)
}

export function getParentEventId(event?: Event) {
  return event?.tags.find(replyETag)?.[1]
}

export function getRootEventId(event?: Event) {
  return event?.tags.find(rootETag)?.[1]
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

export async function extractMentions(content: string, parentEvent?: Event) {
  const pubkeySet = new Set<string>()
  const eventIdSet = new Set<string>()
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
      } else if (type === 'nevent') {
        eventIdSet.add(data.id)
        if (data.author) {
          pubkeySet.add(data.author)
        } else {
          const event = await client.fetchEventById(data.id)
          if (event) {
            pubkeySet.add(event.pubkey)
          }
        }
      } else if (type === 'note') {
        const event = await client.fetchEventById(data)
        if (event) {
          pubkeySet.add(event.pubkey)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (parentEvent) {
    pubkeySet.add(parentEvent.pubkey)
    parentEvent.tags.forEach((tag) => {
      if (tagNameEquals('p')(tag)) {
        pubkeySet.add(tag[1])
      } else if (rootETag(tag)) {
        rootEventId = tag[1]
      } else if (tagNameEquals('e')(tag)) {
        eventIdSet.add(tag[1])
      }
    })
    if (rootEventId) {
      parentEventId = parentEvent.id
    } else {
      rootEventId = parentEvent.id
    }
  }

  if (rootEventId) eventIdSet.delete(rootEventId)
  if (parentEventId) eventIdSet.delete(parentEventId)

  return {
    pubkeys: Array.from(pubkeySet),
    eventIds: Array.from(eventIdSet),
    rootEventId,
    parentEventId
  }
}

export function extractHashtags(content: string) {
  const hashtags: string[] = []
  const matches = content.match(/#([^\s#]+)/g)
  matches?.forEach((m) => {
    const hashtag = m.slice(1).toLowerCase()
    if (hashtag) {
      hashtags.push(hashtag)
    }
  })
  return hashtags
}

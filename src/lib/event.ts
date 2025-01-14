import { BIG_RELAY_URLS, COMMENT_EVENT_KIND, PICTURE_EVENT_KIND } from '@/constants'
import client from '@/services/client.service'
import { TRelayList } from '@/types'
import { Event, kinds, nip19 } from 'nostr-tools'
import { extractImageInfoFromTag, isReplyETag, isRootETag, tagNameEquals } from './tag'
import { isWebsocketUrl, normalizeUrl } from './url'
import { formatPubkey } from './pubkey'

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

export function isCommentEvent(event: Event) {
  return event.kind === COMMENT_EVENT_KIND
}

export function isPictureEvent(event: Event) {
  return event.kind === PICTURE_EVENT_KIND
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

export function getFollowingsFromFollowListEvent(event: Event) {
  return Array.from(
    new Set(
      event.tags
        .filter(tagNameEquals('p'))
        .map(([, pubkey]) => pubkey)
        .filter(Boolean)
        .reverse()
    )
  )
}

export function getRelayListFromRelayListEvent(event?: Event) {
  if (!event) {
    return { write: BIG_RELAY_URLS, read: BIG_RELAY_URLS }
  }

  const relayList = { write: [], read: [] } as TRelayList
  event.tags.filter(tagNameEquals('r')).forEach(([, url, type]) => {
    if (!url || !isWebsocketUrl(url)) return

    const normalizedUrl = normalizeUrl(url)
    switch (type) {
      case 'w':
        relayList.write.push(normalizedUrl)
        break
      case 'r':
        relayList.read.push(normalizedUrl)
        break
      default:
        relayList.write.push(normalizedUrl)
        relayList.read.push(normalizedUrl)
    }
  })
  return {
    write: relayList.write.length ? relayList.write.slice(0, 10) : BIG_RELAY_URLS,
    read: relayList.read.length ? relayList.read.slice(0, 10) : BIG_RELAY_URLS
  }
}

export function getProfileFromProfileEvent(event: Event) {
  try {
    const profileObj = JSON.parse(event.content)
    const username =
      profileObj.display_name?.trim() ||
      profileObj.name?.trim() ||
      profileObj.nip05?.split('@')[0]?.trim()
    return {
      pubkey: event.pubkey,
      banner: profileObj.banner,
      avatar: profileObj.picture,
      username: username || formatPubkey(event.pubkey),
      original_username: username,
      nip05: profileObj.nip05,
      about: profileObj.about,
      created_at: event.created_at
    }
  } catch (err) {
    console.error(err)
    return {
      pubkey: event.pubkey,
      username: formatPubkey(event.pubkey)
    }
  }
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

export async function extractCommentMentions(content: string, parentEvent: Event) {
  const pubkeySet = new Set<string>()
  const quoteEventIdSet = new Set<string>()
  const rootEventId = parentEvent.tags.find(tagNameEquals('E'))?.[1] ?? parentEvent.id
  const rootEventKind = parentEvent.tags.find(tagNameEquals('K'))?.[1] ?? parentEvent.kind
  const rootEventPubkey = parentEvent.tags.find(tagNameEquals('P'))?.[1] ?? parentEvent.pubkey
  const parentEventId = parentEvent.id
  const parentEventKind = parentEvent.kind
  const parentEventPubkey = parentEvent.pubkey

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

  pubkeySet.add(parentEvent.pubkey)

  return {
    pubkeys: Array.from(pubkeySet),
    quoteEventIds: Array.from(quoteEventIdSet),
    rootEventId,
    rootEventKind,
    rootEventPubkey,
    parentEventId,
    parentEventKind,
    parentEventPubkey
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

export function extractFirstPictureFromPictureEvent(event: Event) {
  if (!isPictureEvent(event)) return null
  for (const tag of event.tags) {
    const url = extractImageInfoFromTag(tag)
    if (url) return url
  }
  return null
}

export function extractImagesFromContent(content: string) {
  const images = content.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp|heic)/gi)
  let contentWithoutImages = content
  images?.forEach((url) => {
    contentWithoutImages = contentWithoutImages.replace(url, '').trim()
  })
  contentWithoutImages = contentWithoutImages.replace(/\n{3,}/g, '\n\n').trim()
  return { images, contentWithoutImages }
}

export function extractEmbeddedNotesFromContent(content: string) {
  let c = content
  const embeddedNotes: string[] = []
  const embeddedNoteRegex = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
  ;(c.match(embeddedNoteRegex) || []).forEach((note) => {
    c = c.replace(note, '').trim()
    embeddedNotes.push(note)
  })

  c = c.replace(/\n{3,}/g, '\n\n').trim()

  return { embeddedNotes, contentWithoutEmbeddedNotes: c }
}

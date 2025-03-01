import { BIG_RELAY_URLS, COMMENT_EVENT_KIND, PICTURE_EVENT_KIND } from '@/constants'
import client from '@/services/client.service'
import { TImageInfo, TRelayList } from '@/types'
import { LRUCache } from 'lru-cache'
import { Event, kinds, nip19 } from 'nostr-tools'
import { getAmountFromInvoice, getLightningAddressFromProfile } from './lightning'
import { formatPubkey } from './pubkey'
import { extractImageInfoFromTag, isReplyETag, isRootETag, tagNameEquals } from './tag'
import { isWebsocketUrl, normalizeHttpUrl, normalizeUrl } from './url'

const EVENT_EMBEDDED_EVENT_IDS_CACHE = new LRUCache<string, string[]>({ max: 10000 })
const EVENT_IS_REPLY_NOTE_CACHE = new LRUCache<string, boolean>({ max: 10000 })

export function isNsfwEvent(event: Event) {
  return event.tags.some(
    ([tagName, tagValue]) =>
      tagName === 'content-warning' || (tagName === 't' && tagValue.toLowerCase() === 'nsfw')
  )
}

export function isReplyNoteEvent(event: Event) {
  if (event.kind !== kinds.ShortTextNote) return false

  const cache = EVENT_IS_REPLY_NOTE_CACHE.get(event.id)
  if (cache !== undefined) return cache

  const mentionsEventIds: string[] = []
  for (const [tagName, eventId, , marker] of event.tags) {
    if (tagName !== 'e' || !eventId) continue

    mentionsEventIds.push(eventId)
    if (['root', 'reply'].includes(marker)) {
      EVENT_IS_REPLY_NOTE_CACHE.set(event.id, true)
      return true
    }
  }
  const embeddedEventIds = extractEmbeddedEventIds(event)
  const result = mentionsEventIds.some((id) => !embeddedEventIds.includes(id))
  EVENT_IS_REPLY_NOTE_CACHE.set(event.id, result)
  return result
}

export function isCommentEvent(event: Event) {
  return event.kind === COMMENT_EVENT_KIND
}

export function isPictureEvent(event: Event) {
  return event.kind === PICTURE_EVENT_KIND
}

export function isProtectedEvent(event: Event) {
  return event.tags.some(([tagName]) => tagName === '-')
}

export function isSupportedKind(kind: number) {
  return [kinds.ShortTextNote, PICTURE_EVENT_KIND].includes(kind)
}

export function getParentEventId(event?: Event) {
  if (!event) return undefined
  let tag = event.tags.find(isReplyETag)
  if (!tag) {
    const embeddedEventIds = extractEmbeddedEventIds(event)
    tag = event.tags.findLast(
      ([tagName, tagValue]) => tagName === 'e' && !embeddedEventIds.includes(tagValue)
    )
  }
  if (!tag) return undefined

  try {
    const [, id, relay, , author] = tag
    return nip19.neventEncode({ id, relays: relay ? [relay] : undefined, author })
  } catch {
    return undefined
  }
}

export function getRootEventTag(event?: Event) {
  if (!event) return undefined
  let tag = event.tags.find(isRootETag)
  if (!tag) {
    const embeddedEventIds = extractEmbeddedEventIds(event)
    tag = event.tags.find(
      ([tagName, tagValue]) => tagName === 'e' && !embeddedEventIds.includes(tagValue)
    )
  }
  return tag
}

export function getRootEventId(event?: Event) {
  const tag = getRootEventTag(event)
  if (!tag) return undefined

  try {
    const [, id, relay, , author] = tag
    return nip19.neventEncode({ id, relays: relay ? [relay] : undefined, author })
  } catch {
    return undefined
  }
}

export function isReplaceable(kind: number) {
  return kinds.isReplaceableKind(kind) || kinds.isParameterizedReplaceableKind(kind)
}

export function getEventCoordinate(event: Event) {
  const d = event.tags.find(tagNameEquals('d'))?.[1]
  return d ? `${event.kind}:${event.pubkey}:${d}` : `${event.kind}:${event.pubkey}`
}

export function getSharableEventId(event: Event) {
  const hints = client.getEventHints(event.id).slice(0, 2)
  if (isReplaceable(event.kind)) {
    const identifier = event.tags.find(tagNameEquals('d'))?.[1] ?? ''
    return nip19.naddrEncode({ pubkey: event.pubkey, kind: event.kind, identifier, relays: hints })
  }
  return nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind, relays: hints })
}

export function getUsingClient(event: Event) {
  return event.tags.find(tagNameEquals('client'))?.[1]
}

export function getRelayListFromRelayListEvent(event?: Event) {
  if (!event) {
    return { write: BIG_RELAY_URLS, read: BIG_RELAY_URLS, originalRelays: [] }
  }

  const relayList = { write: [], read: [], originalRelays: [] } as TRelayList
  event.tags.filter(tagNameEquals('r')).forEach(([, url, type]) => {
    if (!url || !isWebsocketUrl(url)) return

    const normalizedUrl = normalizeUrl(url)
    switch (type) {
      case 'write':
        relayList.write.push(normalizedUrl)
        relayList.originalRelays.push({ url: normalizedUrl, scope: 'write' })
        break
      case 'read':
        relayList.read.push(normalizedUrl)
        relayList.originalRelays.push({ url: normalizedUrl, scope: 'read' })
        break
      default:
        relayList.write.push(normalizedUrl)
        relayList.read.push(normalizedUrl)
        relayList.originalRelays.push({ url: normalizedUrl, scope: 'both' })
    }
  })
  return {
    write: relayList.write.length ? relayList.write : BIG_RELAY_URLS,
    read: relayList.read.length ? relayList.read : BIG_RELAY_URLS,
    originalRelays: relayList.originalRelays
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
      website: profileObj.website ? normalizeHttpUrl(profileObj.website) : undefined,
      lud06: profileObj.lud06,
      lud16: profileObj.lud16,
      lightningAddress: getLightningAddressFromProfile(profileObj),
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
  const parentEventPubkey = parentEvent ? parentEvent.pubkey : undefined
  const pubkeys: string[] = []
  const relatedPubkeys: string[] = []
  const matches = content.match(
    /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g
  )

  const addToSet = (arr: string[], pubkey: string) => {
    if (pubkey === parentEventPubkey) return
    if (!arr.includes(pubkey)) arr.push(pubkey)
  }

  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nprofile') {
        addToSet(pubkeys, data.pubkey)
      } else if (type === 'npub') {
        addToSet(pubkeys, data)
      } else if (['nevent', 'note'].includes(type)) {
        const event = await client.fetchEvent(id)
        if (event) {
          addToSet(pubkeys, event.pubkey)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (parentEvent) {
    parentEvent.tags.forEach(([tagName, tagValue]) => {
      if (['p', 'P'].includes(tagName) && !!tagValue) {
        addToSet(relatedPubkeys, tagValue)
      }
    })
  }

  return {
    pubkeys,
    relatedPubkeys: relatedPubkeys.filter((p) => !pubkeys.includes(p)),
    parentEventPubkey
  }
}

export async function extractRelatedEventIds(content: string, parentEvent?: Event) {
  const relatedEventIds: string[] = []
  const quoteEventIds: string[] = []
  let rootEventId: string | undefined
  let parentEventId: string | undefined
  const matches = content.match(/nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g)

  const addToSet = (arr: string[], item: string) => {
    if (!arr.includes(item)) arr.push(item)
  }

  const removeFromSet = (arr: string[], item: string) => {
    const index = arr.indexOf(item)
    if (index !== -1) arr.splice(index, 1)
  }

  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nevent') {
        addToSet(quoteEventIds, data.id)
      } else if (type === 'note') {
        addToSet(quoteEventIds, data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (parentEvent) {
    addToSet(relatedEventIds, parentEvent.id)
    parentEvent.tags.forEach((tag) => {
      if (isRootETag(tag)) {
        rootEventId = tag[1]
      } else if (tagNameEquals('e')(tag)) {
        addToSet(relatedEventIds, tag[1])
      }
    })
    if (rootEventId || isReplyNoteEvent(parentEvent)) {
      parentEventId = parentEvent.id
    } else {
      rootEventId = parentEvent.id
    }
  }

  if (rootEventId) {
    removeFromSet(relatedEventIds, rootEventId)
  }
  if (parentEventId) {
    removeFromSet(relatedEventIds, parentEventId)
  }
  return {
    otherRelatedEventIds: relatedEventIds,
    quoteEventIds,
    rootEventId,
    parentEventId
  }
}

export async function extractCommentMentions(content: string, parentEvent: Event) {
  const quoteEventIds: string[] = []
  const rootEventId = parentEvent.tags.find(tagNameEquals('E'))?.[1] ?? parentEvent.id
  const rootEventKind = parentEvent.tags.find(tagNameEquals('K'))?.[1] ?? parentEvent.kind
  const rootEventPubkey = parentEvent.tags.find(tagNameEquals('P'))?.[1] ?? parentEvent.pubkey
  const parentEventId = parentEvent.id
  const parentEventKind = parentEvent.kind
  const parentEventPubkey = parentEvent.pubkey

  const addToSet = (arr: string[], item: string) => {
    if (!arr.includes(item)) arr.push(item)
  }

  const matches = content.match(/nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g)
  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nevent') {
        addToSet(quoteEventIds, data.id)
      } else if (type === 'note') {
        addToSet(quoteEventIds, data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return {
    quoteEventIds,
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

export function extractImageInfosFromEventTags(event: Event) {
  const images: TImageInfo[] = []
  event.tags.forEach((tag) => {
    const imageInfo = extractImageInfoFromTag(tag)
    if (imageInfo) {
      images.push(imageInfo)
    }
  })
  return images
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

export function extractZapInfoFromReceipt(receiptEvent: Event) {
  if (receiptEvent.kind !== kinds.Zap) return null

  let senderPubkey: string | undefined
  let recipientPubkey: string | undefined
  let eventId: string | undefined
  let invoice: string | undefined
  let amount: number | undefined
  let comment: string | undefined
  let description: string | undefined
  let preimage: string | undefined
  try {
    receiptEvent.tags.forEach(([tagName, tagValue]) => {
      switch (tagName) {
        case 'P':
          senderPubkey = tagValue
          break
        case 'p':
          recipientPubkey = tagValue
          break
        case 'e':
          eventId = tagValue
          break
        case 'bolt11':
          invoice = tagValue
          break
        case 'description':
          description = tagValue
          break
        case 'preimage':
          preimage = tagValue
          break
      }
    })
    if (!recipientPubkey || !invoice) return null
    amount = invoice ? getAmountFromInvoice(invoice) : 0
    if (description) {
      try {
        const zapRequest = JSON.parse(description)
        comment = zapRequest.content
        if (!senderPubkey) {
          senderPubkey = zapRequest.pubkey
        }
      } catch {
        // ignore
      }
    }

    return {
      senderPubkey,
      recipientPubkey,
      eventId,
      invoice,
      amount,
      comment,
      preimage
    }
  } catch {
    return null
  }
}

export function extractEmbeddedEventIds(event: Event) {
  const cache = EVENT_EMBEDDED_EVENT_IDS_CACHE.get(event.id)
  if (cache) return cache

  const embeddedEventIds: string[] = []
  const embeddedNoteRegex = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g
  ;(event.content.match(embeddedNoteRegex) || []).forEach((note) => {
    try {
      const { type, data } = nip19.decode(note.split(':')[1])
      if (type === 'nevent') {
        embeddedEventIds.push(data.id)
      } else if (type === 'note') {
        embeddedEventIds.push(data)
      }
    } catch {
      // ignore
    }
  })
  EVENT_EMBEDDED_EVENT_IDS_CACHE.set(event.id, embeddedEventIds)
  return embeddedEventIds
}

export function getLatestEvent(events: Event[]) {
  return events.sort((a, b) => b.created_at - a.created_at)[0]
}

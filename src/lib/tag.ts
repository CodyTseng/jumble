import client from '@/services/client.service'
import { TImageInfo } from '@/types'
import { isBlurhashValid } from 'blurhash'
import { Event, nip19 } from 'nostr-tools'
import { isValidPubkey } from './pubkey'

export function tagNameEquals(tagName: string) {
  return (tag: string[]) => tag[0] === tagName
}

export function isReplyETag([tagName, , , marker]: string[]) {
  return tagName === 'e' && marker === 'reply'
}

export function isRootETag([tagName, , , marker]: string[]) {
  return tagName === 'e' && marker === 'root'
}

export function isMentionETag([tagName, , , marker]: string[]) {
  return tagName === 'e' && marker === 'mention'
}

export function generateEventIdFromETag(tag: string[]) {
  try {
    const [, id, relay, , author] = tag
    return nip19.neventEncode({ id, relays: relay ? [relay] : undefined, author })
  } catch {
    return undefined
  }
}

export function generateEventIdFromATag(tag: string[]) {
  try {
    const [, coordinate, relay] = tag
    const [kind, pubkey, identifier] = coordinate.split(':')
    return nip19.naddrEncode({
      kind: Number(kind),
      pubkey,
      identifier,
      relays: relay ? [relay] : undefined
    })
  } catch {
    return undefined
  }
}

export function generateEventId(event: Pick<Event, 'id' | 'pubkey'>) {
  const relay = client.getEventHint(event.id)
  return nip19.neventEncode({ id: event.id, author: event.pubkey, relays: [relay] })
}

export function extractImageInfoFromTag(tag: string[]): TImageInfo | null {
  if (tag[0] !== 'imeta') return null
  const urlItem = tag.find((item) => item.startsWith('url '))
  const url = urlItem?.slice(4)
  if (!url) return null

  const image: TImageInfo = { url }
  const blurHashItem = tag.find((item) => item.startsWith('blurhash '))
  const blurHash = blurHashItem?.slice(9)
  if (blurHash) {
    const validRes = isBlurhashValid(blurHash)
    if (validRes.result) {
      image.blurHash = blurHash
    }
  }
  const dimItem = tag.find((item) => item.startsWith('dim '))
  const dim = dimItem?.slice(4)
  if (dim) {
    const [width, height] = dim.split('x').map(Number)
    if (width && height) {
      image.dim = { width, height }
    }
  }
  return image
}

export function extractPubkeysFromEventTags(tags: string[][]) {
  return Array.from(
    new Set(
      tags
        .filter(tagNameEquals('p'))
        .map(([, pubkey]) => pubkey)
        .filter((pubkey) => !!pubkey && isValidPubkey(pubkey))
        .reverse()
    )
  )
}

export function isSameTag(tag1: string[], tag2: string[]) {
  if (tag1.length !== tag2.length) return false
  for (let i = 0; i < tag1.length; i++) {
    if (tag1[i] !== tag2[i]) return false
  }
  return true
}

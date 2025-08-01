import { TEmoji, TImageInfo } from '@/types'
import { isBlurhashValid } from 'blurhash'
import { nip19 } from 'nostr-tools'
import { isValidPubkey } from './pubkey'
import { normalizeHttpUrl } from './url'

export function isSameTag(tag1: string[], tag2: string[]) {
  if (tag1.length !== tag2.length) return false
  for (let i = 0; i < tag1.length; i++) {
    if (tag1[i] !== tag2[i]) return false
  }
  return true
}

export function tagNameEquals(tagName: string) {
  return (tag: string[]) => tag[0] === tagName
}

export function generateBech32IdFromETag(tag: string[]) {
  try {
    const [, id, relay, , author] = tag
    return nip19.neventEncode({ id, relays: relay ? [relay] : undefined, author })
  } catch {
    return undefined
  }
}

export function generateBech32IdFromATag(tag: string[]) {
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

export function getImageInfoFromImetaTag(tag: string[], pubkey?: string): TImageInfo | null {
  if (tag[0] !== 'imeta') return null
  const urlItem = tag.find((item) => item.startsWith('url '))
  const url = urlItem?.slice(4)
  if (!url) return null

  const image: TImageInfo = { url, pubkey }
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

export function getPubkeysFromPTags(tags: string[][]) {
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

export function getEmojiInfosFromEmojiTags(tags: string[][] = []) {
  return tags
    .map((tag) => {
      if (tag.length < 3 || tag[0] !== 'emoji') return null
      return { shortcode: tag[1], url: tag[2] }
    })
    .filter(Boolean) as TEmoji[]
}

export function getServersFromServerTags(tags: string[][] = []) {
  return tags
    .filter(tagNameEquals('server'))
    .map(([, url]) => (url ? normalizeHttpUrl(url) : ''))
    .filter(Boolean)
}

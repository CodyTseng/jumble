import { TEmoji, TImetaInfo } from '@/types'
import { base64 } from '@scure/base'
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
    const [, id, relay, markerOrPubkey, pubkey] = tag
    let author: string | undefined
    if (markerOrPubkey && isValidPubkey(markerOrPubkey)) {
      author = markerOrPubkey
    } else if (pubkey && isValidPubkey(pubkey)) {
      author = pubkey
    }
    return nip19.neventEncode({ id, relays: relay ? [relay] : undefined, author })
  } catch {
    return undefined
  }
}

export function generateBech32IdFromATag(tag: string[]) {
  try {
    const [, coordinate, relay] = tag
    const [kind, pubkey, ...items] = coordinate.split(':')
    const identifier = items.join(':')
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

export function getImetaInfoFromImetaTag(tag: string[], pubkey?: string): TImetaInfo | null {
  if (tag[0] !== 'imeta') return null
  const imeta: Partial<TImetaInfo> = { pubkey }

  for (let i = 1; i < tag.length; i++) {
    const [k, v] = tag[i].split(' ')
    switch (k) {
      case 'url':
        imeta.url = v
        break
      case 'thumbhash':
        try {
          imeta.thumbHash = base64.decode(v)
        } catch {
          /***/
        }
        break
      case 'blurhash': {
        const validRes = isBlurhashValid(v)
        if (validRes.result) {
          imeta.blurHash = v
        }
        break
      }
      case 'dim': {
        const [width, height] = v.split('x').map(Number)
        if (width && height) {
          imeta.dim = { width, height }
        }
        break
      }
    }
  }

  if (!imeta.url) return null
  return imeta as TImetaInfo
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

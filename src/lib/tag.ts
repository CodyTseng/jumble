import { TImageInfo } from '@/types'
import { isBlurhashValid } from 'blurhash'
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

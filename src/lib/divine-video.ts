// Divine video parsing utilities
// Adapted from divine-web for parsing kind 34236 video events

import { Event } from 'nostr-tools'

export const DIVINE_VIDEO_KIND = 34236
export const DIVINE_RELAY_URL = 'wss://relay.divine.video'

export interface ParsedVideoData {
  id: string
  pubkey: string
  kind: number
  createdAt: number
  originalVineTimestamp?: number
  content: string
  videoUrl: string
  fallbackVideoUrls?: string[]
  hlsUrl?: string
  thumbnailUrl?: string
  blurhash?: string
  title?: string
  duration?: number
  hashtags: string[]
  vineId: string | null
  loopCount?: number
  likeCount?: number
  repostCount?: number
  commentCount?: number
  isVineMigrated: boolean
  originalEvent?: Event
}

interface VideoMetadata {
  url: string
  fallbackUrls?: string[]
  hlsUrl?: string
  mimeType?: string
  dimensions?: string
  blurhash?: string
  thumbnailUrl?: string
  duration?: number
  size?: number
  hash?: string
}

/**
 * Checks if a URL looks like it could be a video URL
 */
function isValidVideoUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    // Block vine.co URLs - they're CORS-blocked and the site is dead
    if (parsedUrl.hostname === 'vine.co' || parsedUrl.hostname.endsWith('.vine.co')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Parse imeta tag to extract video metadata
 */
function parseImetaTag(tag: string[]): VideoMetadata | null {
  if (tag[0] !== 'imeta') return null

  const metadata: VideoMetadata = { url: '' }
  const isFormat1 = tag[1] && tag[1].includes(' ')

  if (isFormat1) {
    for (let i = 1; i < tag.length; i++) {
      const element = tag[i]
      if (!element || typeof element !== 'string') continue

      const spaceIndex = element.indexOf(' ')
      if (spaceIndex === -1) continue

      const key = element.substring(0, spaceIndex)
      const value = element.substring(spaceIndex + 1)

      if (!value) continue

      switch (key) {
        case 'url':
          if (isValidVideoUrl(value)) {
            metadata.url = value
          }
          break
        case 'm':
          metadata.mimeType = value
          break
        case 'dim':
          metadata.dimensions = value
          break
        case 'blurhash':
          metadata.blurhash = value
          break
        case 'image':
          metadata.thumbnailUrl = value
          break
        case 'duration':
          metadata.duration = parseInt(value)
          break
        case 'size':
          metadata.size = parseInt(value)
          break
        case 'x':
          metadata.hash = value
          break
        case 'hls':
          metadata.hlsUrl = value
          break
      }
    }
  } else {
    for (let i = 1; i < tag.length; i += 2) {
      const key = tag[i]
      const value = tag[i + 1]

      if (!key || !value || typeof key !== 'string' || typeof value !== 'string') continue

      switch (key) {
        case 'url':
          if (isValidVideoUrl(value)) {
            metadata.url = value
          }
          break
        case 'm':
          metadata.mimeType = value
          break
        case 'dim':
          metadata.dimensions = value
          break
        case 'blurhash':
          metadata.blurhash = value
          break
        case 'image':
          metadata.thumbnailUrl = value
          break
        case 'duration':
          metadata.duration = parseInt(value)
          break
        case 'size':
          metadata.size = parseInt(value)
          break
        case 'x':
          metadata.hash = value
          break
        case 'hls':
          metadata.hlsUrl = value
          break
      }
    }
  }

  return metadata.url ? metadata : null
}

/**
 * Extract video URL from event
 */
function extractVideoUrl(event: Event): string | null {
  // Primary video URL should be in `imeta` tag with url field
  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const metadata = parseImetaTag(tag)
      if (metadata?.url && isValidVideoUrl(metadata.url)) {
        return metadata.url
      }
    }
  }

  // Fallback 1: Check 'url' tag
  const urlTag = event.tags.find((tag) => tag[0] === 'url' && tag[1] && isValidVideoUrl(tag[1]))
  if (urlTag?.[1]) {
    return urlTag[1]
  }

  // Fallback 2: Check 'r' tag for video reference
  const rTags = event.tags.filter((tag) => tag[0] === 'r' && tag[1] && isValidVideoUrl(tag[1]))
  for (const rTag of rTags) {
    if (rTag[1].includes('.mp4')) {
      return rTag[1]
    }
  }

  if (rTags.length > 0) {
    return rTags[0][1]
  }

  // Last resort: Parse URLs from content
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urls = event.content.match(urlRegex) || []
  for (const url of urls) {
    if (isValidVideoUrl(url)) {
      return url
    }
  }

  return null
}

/**
 * Extract all video URLs for fallback
 */
function extractAllVideoUrls(event: Event): string[] {
  const urls: string[] = []

  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const metadata = parseImetaTag(tag)
      if (metadata?.url && isValidVideoUrl(metadata.url) && !urls.includes(metadata.url)) {
        if (metadata.url.includes('.mp4')) {
          urls.unshift(metadata.url)
        } else {
          urls.push(metadata.url)
        }
      }
    }
  }

  const rTags = event.tags.filter((tag) => tag[0] === 'r' && tag[1] && isValidVideoUrl(tag[1]))
  for (const rTag of rTags) {
    if (rTag[1].includes('.mp4') && !urls.includes(rTag[1])) {
      urls.push(rTag[1])
    }
  }

  const urlTag = event.tags.find((tag) => tag[0] === 'url' && tag[1] && isValidVideoUrl(tag[1]))
  if (urlTag?.[1] && !urls.includes(urlTag[1])) {
    urls.push(urlTag[1])
  }

  return urls.slice(0, 3)
}

/**
 * Get the d tag (vine ID) from an event
 */
export function getVineId(event: Event): string | null {
  const dTag = event.tags.find((tag) => tag[0] === 'd')
  return dTag?.[1] || null
}

/**
 * Get original publication timestamp
 */
function getOriginalVineTimestamp(event: Event): number | undefined {
  const publishedAtTag = event.tags.find((tag) => tag[0] === 'published_at')
  if (publishedAtTag?.[1]) {
    const timestamp = parseInt(publishedAtTag[1])
    if (!isNaN(timestamp)) {
      return timestamp
    }
  }

  const vineCreatedAtTag = event.tags.find(
    (tag) => tag[0] === 'vine_created_at' || tag[0] === 'original_created_at'
  )
  if (vineCreatedAtTag?.[1]) {
    const timestamp = parseInt(vineCreatedAtTag[1])
    if (!isNaN(timestamp)) return timestamp
  }

  return undefined
}

/**
 * Get origin platform information
 */
function getOriginPlatform(event: Event):
  | {
      platform: string
      externalId: string
      url?: string
    }
  | undefined {
  const originTag = event.tags.find((tag) => tag[0] === 'origin')
  if (originTag && originTag[1] && originTag[2]) {
    return {
      platform: originTag[1],
      externalId: originTag[2],
      url: originTag[3]
    }
  }

  const platformTag = event.tags.find((tag) => tag[0] === 'platform')
  if (platformTag && platformTag[1]) {
    const dTag = event.tags.find((tag) => tag[0] === 'd')
    const externalId = dTag?.[1] || ''
    const rTag = event.tags.find((tag) => tag[0] === 'r' && tag[1]?.includes('vine.co'))

    return {
      platform: platformTag[1],
      externalId,
      url: rTag?.[1]
    }
  }

  return undefined
}

/**
 * Check if video is migrated from original Vine platform
 */
function isVineMigrated(event: Event): boolean {
  const origin = getOriginPlatform(event)
  return origin?.platform?.toLowerCase() === 'vine'
}

/**
 * Get loop count from event tags
 */
function getLoopCount(event: Event): number {
  const loopCountTag = event.tags.find((tag) => tag[0] === 'loop_count' || tag[0] === 'loops')
  if (loopCountTag?.[1]) {
    const count = parseInt(loopCountTag[1])
    if (!isNaN(count)) return count
  }

  const viewCountTag = event.tags.find((tag) => tag[0] === 'view_count' || tag[0] === 'views')
  if (viewCountTag?.[1]) {
    const count = parseInt(viewCountTag[1])
    if (!isNaN(count)) return count
  }

  return 0
}

/**
 * Get original like/repost/comment counts
 */
function getOriginalLikeCount(event: Event): number | undefined {
  const likesTag = event.tags.find((tag) => tag[0] === 'likes')
  if (likesTag?.[1]) {
    const count = parseInt(likesTag[1])
    if (!isNaN(count)) return count
  }
  return undefined
}

function getOriginalRepostCount(event: Event): number | undefined {
  const repostsTag = event.tags.find((tag) => tag[0] === 'reposts' || tag[0] === 'revines')
  if (repostsTag?.[1]) {
    const count = parseInt(repostsTag[1])
    if (!isNaN(count)) return count
  }
  return undefined
}

function getOriginalCommentCount(event: Event): number | undefined {
  const commentsTag = event.tags.find((tag) => tag[0] === 'comments')
  if (commentsTag?.[1]) {
    const count = parseInt(commentsTag[1])
    if (!isNaN(count)) return count
  }
  return undefined
}

/**
 * Get thumbnail URL
 */
function getThumbnailUrl(event: Event): string | undefined {
  // Check imeta tags first
  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const metadata = parseImetaTag(tag)
      if (metadata?.thumbnailUrl) {
        return metadata.thumbnailUrl
      }
    }
  }

  const imageTag = event.tags.find((tag) => tag[0] === 'image')
  if (imageTag?.[1]) {
    return imageTag[1]
  }

  const thumbTag = event.tags.find((tag) => tag[0] === 'thumb')
  if (thumbTag?.[1]) {
    return thumbTag[1]
  }

  return undefined
}

/**
 * Validate that a video event has required fields
 */
export function validateVideoEvent(event: Event): boolean {
  if (event.kind !== DIVINE_VIDEO_KIND) return false

  const vineId = getVineId(event)
  if (!vineId) {
    return false
  }

  return true
}

/**
 * Parse video events into standardized format
 */
export function parseVideoEvents(events: Event[]): ParsedVideoData[] {
  const parsedVideos: ParsedVideoData[] = []

  for (const event of events) {
    if (!validateVideoEvent(event)) continue

    const videoUrl = extractVideoUrl(event)
    if (!videoUrl) continue

    const vineId = getVineId(event)
    if (!vineId) continue

    const titleTag = event.tags.find((tag) => tag[0] === 'title')
    const title = titleTag?.[1]

    const hashtags = event.tags
      .filter((tag) => tag[0] === 't')
      .map((tag) => tag[1])
      .filter(Boolean)

    const allUrls = extractAllVideoUrls(event)
    const fallbackUrls = allUrls.filter((u) => u !== videoUrl)
    const hlsUrl = allUrls.find((u) => u.includes('.m3u8'))

    // Get duration from imeta
    let duration: number | undefined
    for (const tag of event.tags) {
      if (tag[0] === 'imeta') {
        const metadata = parseImetaTag(tag)
        if (metadata?.duration) {
          duration = metadata.duration
          break
        }
      }
    }

    // Get blurhash from imeta
    let blurhash: string | undefined
    for (const tag of event.tags) {
      if (tag[0] === 'imeta') {
        const metadata = parseImetaTag(tag)
        if (metadata?.blurhash) {
          blurhash = metadata.blurhash
          break
        }
      }
    }

    parsedVideos.push({
      id: event.id,
      pubkey: event.pubkey,
      kind: event.kind,
      createdAt: event.created_at,
      originalVineTimestamp: getOriginalVineTimestamp(event),
      content: event.content,
      videoUrl,
      fallbackVideoUrls: fallbackUrls.length > 0 ? fallbackUrls : undefined,
      hlsUrl,
      thumbnailUrl: getThumbnailUrl(event),
      blurhash,
      title,
      duration,
      hashtags,
      vineId,
      loopCount: getLoopCount(event),
      likeCount: getOriginalLikeCount(event),
      repostCount: getOriginalRepostCount(event),
      commentCount: getOriginalCommentCount(event),
      isVineMigrated: isVineMigrated(event),
      originalEvent: event
    })
  }

  return parsedVideos
}

/**
 * Format view count for display
 */
export function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

/**
 * Format duration for display (seconds -> MM:SS)
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

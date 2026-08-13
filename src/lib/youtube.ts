export const YOUTUBE_PLAYER_ORIGIN = 'https://www.youtube.com'

export const YOUTUBE_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
} as const

export type YouTubeMessage = {
  event: string
  id?: string
  info?: unknown
}

export function parseYouTubeMessage(data: unknown): YouTubeMessage | null {
  try {
    const value = typeof data === 'string' ? JSON.parse(data) : data
    if (!value || typeof value !== 'object') return null
    const message = value as Partial<YouTubeMessage>
    if (typeof message.event !== 'string') return null
    if (message.id !== undefined && typeof message.id !== 'string') return null
    return message as YouTubeMessage
  } catch {
    return null
  }
}

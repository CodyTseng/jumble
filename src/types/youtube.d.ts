declare global {
  interface Window {
    YT: {
      Player: new (element: HTMLElement, config: YouTubePlayerConfig) => YouTubePlayer
      PlayerState: {
        UNSTARTED: number
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YouTubePlayerConfig {
  videoId: string
  width?: number
  height?: number
  playerVars?: {
    autoplay?: 0 | 1
    controls?: 0 | 1
    start?: number
    end?: number
    mute?: 0 | 1
  }
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void
    onStateChange?: (event: { data: number; target: YouTubePlayer }) => void
    onError?: (event: { data: number }) => void
  }
}

export interface YouTubePlayer {
  destroy(): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  isMuted(): boolean
  mute(): void
  unMute(): void
}

export {}

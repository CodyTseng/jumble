import { YouTubePlayer } from '@/types/youtube'
import { YOUTUBE_PLAYER_STATE } from '@/lib/youtube'
import { atom, getDefaultStore } from 'jotai'

export const hasBackgroundAudioAtom = atom(false)
const store = getDefaultStore()

type Media = HTMLMediaElement | YouTubePlayer
type PendingPlayRequest = { media: Media }
type PendingAutoPlayRequest = { media: Media; canPlay: () => boolean }

export class MediaManagerService extends EventTarget {
  static instance: MediaManagerService

  private currentMedia: Media | null = null
  private pendingPlayRequest: PendingPlayRequest | null = null
  private pendingAutoPlayRequest: PendingAutoPlayRequest | null = null

  constructor() {
    super()
  }

  public static getInstance(): MediaManagerService {
    if (!MediaManagerService.instance) {
      MediaManagerService.instance = new MediaManagerService()
    }
    return MediaManagerService.instance
  }

  pause(media: Media | null) {
    if (!media) {
      return
    }
    if (isPipElement(media)) {
      return
    }
    this.registerPaused(media)
    _pause(media)
  }

  registerPlaying(media: Media | null) {
    if (!media) {
      return
    }
    this.activate(media)
  }

  registerPaused(media: Media | null) {
    if (!media) {
      return
    }
    const releasedCurrentMedia = this.currentMedia === media
    if (releasedCurrentMedia) {
      this.currentMedia = null
    }
    if (this.pendingPlayRequest?.media === media) {
      this.pendingPlayRequest = null
    }
    this.cancelAutoPlay(media)
    if (releasedCurrentMedia) {
      this.playPendingAutoPlayRequest()
    }
  }

  autoPlay(media: Media, canPlay: () => boolean = () => true) {
    this.releaseDetachedCurrentMedia()
    if (
      document.pictureInPictureElement &&
      isMediaPlaying(document.pictureInPictureElement as HTMLMediaElement)
    ) {
      return
    }
    if (
      store.get(hasBackgroundAudioAtom) &&
      this.currentMedia &&
      isMediaPlaying(this.currentMedia)
    ) {
      return
    }
    if (
      this.currentMedia &&
      this.currentMedia !== media &&
      (this.pendingPlayRequest?.media === this.currentMedia || isMediaPlaying(this.currentMedia))
    ) {
      this.pendingAutoPlayRequest = { media, canPlay }
      return
    }
    this.pendingAutoPlayRequest = null
    this.play(media)
  }

  cancelAutoPlay(media: Media) {
    if (this.pendingAutoPlayRequest?.media === media) {
      this.pendingAutoPlayRequest = null
    }
  }

  play(media: Media | null) {
    if (!media) {
      return
    }
    this.cancelAutoPlay(media)
    this.activate(media)
    if (isMediaPlaying(media) || this.pendingPlayRequest?.media === media) {
      return
    }

    const request = { media }
    this.pendingPlayRequest = request
    _play(media)
      .then(() => {
        if (this.pendingPlayRequest === request) {
          this.pendingPlayRequest = null
        }
      })
      .catch((error) => {
        if (this.pendingPlayRequest === request) {
          this.pendingPlayRequest = null
          if (this.currentMedia === media) {
            this.currentMedia = null
            this.playPendingAutoPlayRequest()
          }
        }
        if (!isAbortError(error)) {
          console.error('Error playing media:', error)
        }
      })
  }

  private activate(media: Media) {
    if (document.pictureInPictureElement && document.pictureInPictureElement !== media) {
      ;(document.pictureInPictureElement as HTMLMediaElement).pause()
    }
    if (this.currentMedia && this.currentMedia !== media) {
      _pause(this.currentMedia)
      if (this.pendingPlayRequest?.media === this.currentMedia) {
        this.pendingPlayRequest = null
      }
    }
    this.currentMedia = media
  }

  private releaseDetachedCurrentMedia() {
    const media = this.currentMedia
    if (!media || !isDetachedMedia(media)) {
      return
    }
    this.currentMedia = null
    if (this.pendingPlayRequest?.media === media) {
      this.pendingPlayRequest = null
    }
    this.cancelAutoPlay(media)
  }

  private playPendingAutoPlayRequest() {
    const request = this.pendingAutoPlayRequest
    this.pendingAutoPlayRequest = null
    if (!request || !request.canPlay()) {
      return
    }
    this.autoPlay(request.media, request.canPlay)
  }

  playAudioBackground(src: string, time: number = 0, pubkey?: string) {
    this.dispatchEvent(new CustomEvent('playAudioBackground', { detail: { src, time, pubkey } }))
    store.set(hasBackgroundAudioAtom, true)
  }

  stopAudioBackground() {
    this.dispatchEvent(new Event('stopAudioBackground'))
    store.set(hasBackgroundAudioAtom, false)
  }
}

const instance = MediaManagerService.getInstance()
export default instance

function isYouTubePlayer(media: Media): media is YouTubePlayer {
  return (media as YouTubePlayer).pauseVideo !== undefined
}

function isMediaPlaying(media: Media) {
  if (isYouTubePlayer(media)) {
    const state = media.getPlayerState()
    return state === YOUTUBE_PLAYER_STATE.PLAYING || state === YOUTUBE_PLAYER_STATE.BUFFERING
  }
  return !media.paused && !media.ended
}

function isDetachedMedia(media: Media) {
  return !isYouTubePlayer(media) && media.isConnected === false
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

function isPipElement(media: Media) {
  if (isYouTubePlayer(media)) {
    return false // YouTube players do not support Picture-in-Picture
  }
  if (document.pictureInPictureElement === media) {
    return true
  }
  return (media as any).webkitPresentationMode === 'picture-in-picture'
}

function _pause(media: Media) {
  if (isYouTubePlayer(media)) {
    return media.pauseVideo()
  }
  return media.pause()
}

async function _play(media: Media) {
  if (isYouTubePlayer(media)) {
    return media.playVideo()
  }
  return media.play()
}

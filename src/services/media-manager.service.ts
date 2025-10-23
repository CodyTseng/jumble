import { YouTubePlayer } from '@/types/youtube'
import { atom, getDefaultStore } from 'jotai'

export const hasBackgroundAudioAtom = atom(false)
const store = getDefaultStore()

type Media = HTMLMediaElement | YouTubePlayer

class MediaManagerService extends EventTarget {
  static instance: MediaManagerService

  private currentMedia: Media | null = null

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
    if (this.currentMedia === media) {
      this.currentMedia = null
    }
    _pause(media)
  }

  autoPlay(media: Media) {
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
    this.play(media)
  }

  play(media: Media | null) {
    if (!media) {
      return
    }
    if (document.pictureInPictureElement && document.pictureInPictureElement !== media) {
      ;(document.pictureInPictureElement as HTMLMediaElement).pause()
    }
    if (this.currentMedia && this.currentMedia !== media) {
      _pause(this.currentMedia)
    }
    this.currentMedia = media
    if (isMediaPlaying(media)) {
      return
    }

    _play(this.currentMedia).catch((error) => {
      console.error('Error playing media:', error)
      this.currentMedia = null
    })
  }

  playAudioBackground(src: string, time: number = 0) {
    this.dispatchEvent(new CustomEvent('playAudioBackground', { detail: { src, time } }))
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
    return media.getPlayerState() === window.YT.PlayerState.PLAYING
  }
  return media.currentTime > 0 && !media.paused && !media.ended && media.readyState >= 2
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

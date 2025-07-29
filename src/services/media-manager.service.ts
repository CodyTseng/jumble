class MediaManagerService {
  static instance: MediaManagerService

  private currentMedia: HTMLMediaElement | null = null

  constructor() {
    if (!MediaManagerService.instance) {
      MediaManagerService.instance = this
    }
    return MediaManagerService.instance
  }

  pause(media: HTMLMediaElement) {
    if (isPipElement(media)) {
      return
    }
    if (this.currentMedia === media) {
      this.currentMedia = null
    }
    media.pause()
  }

  autoPlay(media: HTMLMediaElement) {
    if (
      document.pictureInPictureElement &&
      isMediaPlaying(document.pictureInPictureElement as HTMLMediaElement)
    ) {
      return
    }
    this.play(media)
  }

  play(media: HTMLMediaElement) {
    if (document.pictureInPictureElement && document.pictureInPictureElement !== media) {
      ;(document.pictureInPictureElement as HTMLMediaElement).pause()
    }
    if (this.currentMedia && this.currentMedia !== media) {
      this.currentMedia.pause()
    }
    this.currentMedia = media
    if (isMediaPlaying(media)) {
      return
    }

    this.currentMedia.play().catch((error) => {
      console.error('Error playing media:', error)
      this.currentMedia = null
    })
  }
}

const instance = new MediaManagerService()
export default instance

function isMediaPlaying(media: HTMLMediaElement) {
  return media.currentTime > 0 && !media.paused && !media.ended && media.readyState >= 2
}

function isPipElement(media: HTMLMediaElement) {
  if (document.pictureInPictureElement === media) {
    return true
  }
  return (media as any).webkitPresentationMode === 'picture-in-picture'
}

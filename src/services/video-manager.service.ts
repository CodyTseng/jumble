class VideoManagerService {
  static instance: VideoManagerService

  private currentVideo: HTMLVideoElement | null = null

  constructor() {
    if (!VideoManagerService.instance) {
      VideoManagerService.instance = this
    }
    return VideoManagerService.instance
  }

  pause(video: HTMLVideoElement) {
    if (isPipElement(video)) {
      return
    }
    if (this.currentVideo === video) {
      this.currentVideo = null
    }
    video.pause()
  }

  autoPlay(video: HTMLVideoElement) {
    if (
      document.pictureInPictureElement &&
      isVideoPlaying(document.pictureInPictureElement as HTMLVideoElement)
    ) {
      return
    }
    this.play(video)
  }

  play(video: HTMLVideoElement) {
    if (document.pictureInPictureElement && document.pictureInPictureElement !== video) {
      ;(document.pictureInPictureElement as HTMLVideoElement).pause()
    }
    if (this.currentVideo && this.currentVideo !== video) {
      this.currentVideo.pause()
    }
    this.currentVideo = video
    if (isVideoPlaying(video)) {
      return
    }

    this.currentVideo.play().catch((error) => {
      console.error('Error playing video:', error)
      this.currentVideo = null
    })
  }
}

const instance = new VideoManagerService()
export default instance

function isVideoPlaying(video: HTMLVideoElement) {
  return video.currentTime > 0 && !video.paused && !video.ended && video.readyState >= 2
}

function isPipElement(video: HTMLVideoElement) {
  if (document.pictureInPictureElement === video) {
    return true
  }
  return (video as any).webkitPresentationMode === 'picture-in-picture'
}

class VideoManagerService {
  static instance: VideoManagerService

  private currentVideo: HTMLVideoElement | null = null

  constructor() {
    if (!VideoManagerService.instance) {
      VideoManagerService.instance = this
      document.addEventListener('leavepictureinpicture', (e) => {
        ;(e.target as HTMLVideoElement).pause()
      })
    }
    return VideoManagerService.instance
  }

  async enterPiP(video: HTMLVideoElement) {
    if (this.currentVideo && this.currentVideo !== video) {
      this.exitPiP(this.currentVideo)
    }

    try {
      if (
        (video as any).webkitSupportsPresentationMode &&
        typeof (video as any).webkitSetPresentationMode === 'function'
      ) {
        ;(video as any).webkitSetPresentationMode('picture-in-picture')

        // Check if Safari PiP succeeded
        if ((video as any).webkitPresentationMode !== 'picture-in-picture') {
          throw new Error('Safari PiP failed to activate.')
        }
      } else {
        await video.requestPictureInPicture()
      }

      this.currentVideo = video
    } catch (error) {
      console.error('Failed to enter Picture-in-Picture:', error)
      video.pause()
    }
  }

  private exitPiP(video: HTMLVideoElement) {
    video.pause()
    if (
      (video as any).webkitSupportsPresentationMode &&
      typeof (video as any).webkitSetPresentationMode === 'function'
    ) {
      ;(video as any).webkitSetPresentationMode('inline')
    } else {
      document.exitPictureInPicture()
    }

    if (this.currentVideo === video) {
      this.currentVideo = null
    }
  }

  async playVideo(video: HTMLVideoElement) {
    if (this.currentVideo && this.currentVideo !== video) {
      this.exitPiP(this.currentVideo)
    }
    this.currentVideo = video
    video.play()
  }
}

const instance = new VideoManagerService()
export default instance

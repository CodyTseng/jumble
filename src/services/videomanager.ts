class VideoManager {
  private static currentVideo: HTMLVideoElement | null = null

  static async enterPiP(video: HTMLVideoElement) {
    if (VideoManager.currentVideo && VideoManager.currentVideo !== video) {
      await VideoManager.exitPiP(VideoManager.currentVideo)
    }
    
    // cates error and pauses video if pip fails
    try {
      if ('requestPictureInPicture' in video) {
        await video.requestPictureInPicture()
      } else if ('webkitSetPresentationMode' in video) {
        ;(video as any).webkitSetPresentationMode('picture-in-picture')
      }

      VideoManager.currentVideo = video
    } catch (err) {
      console.error('Failed to enter Picture-in-Picture:', err)
      video.pause()
    }
  }

  static async exitPiP(video: HTMLVideoElement) {
    video.pause()
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
    } else if ('webkitSetPresentationMode' in video) {
      ;(video as any).webkitSetPresentationMode('inline')
    }

    if (VideoManager.currentVideo === video) {
      VideoManager.currentVideo = null
    }
  }

  static async playVideo(video: HTMLVideoElement) {
    if (VideoManager.currentVideo && VideoManager.currentVideo !== video) {
      await VideoManager.exitPiP(VideoManager.currentVideo)
    }
    VideoManager.currentVideo = video
    video.play()
  }
}

export default VideoManager

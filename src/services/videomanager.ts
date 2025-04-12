class VideoManager {
  private static currentVideo: HTMLVideoElement | null = null

  static async enterPiP(video: HTMLVideoElement) {
    if (VideoManager.currentVideo && VideoManager.currentVideo !== video) {
      await VideoManager.exitPiP(VideoManager.currentVideo)
    }

    VideoManager.currentVideo = video

    if ('requestPictureInPicture' in video) {
      await video.requestPictureInPicture()
    } else if ('webkitSetPresentationMode' in video) {
      ;(video as any).webkitSetPresentationMode('picture-in-picture')
    }
  }

  static async exitPiP(video: HTMLVideoElement) {
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
    } else if ('webkitSetPresentationMode' in video) {
      ;(video as any).webkitSetPresentationMode('inline')
    }

    if (VideoManager.currentVideo === video) {
      VideoManager.currentVideo = null
    }
  }

  static getCurrentVideo() {
    return VideoManager.currentVideo
  }
}

export default VideoManager

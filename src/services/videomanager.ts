type PiPCallback = () => void

class VideoManager {
  private currentVideo: HTMLVideoElement | null = null
  private onPiPExitCallback: PiPCallback | null = null

  async setCurrent(video: HTMLVideoElement) {
    if (this.currentVideo && this.currentVideo !== video) {
      await this.exitPiPIfActive()
      this.onPiPExitCallback?.()
    }

    this.currentVideo = video
  }

  async exitPiPIfActive() {
    const video = this.currentVideo
    if (!video) return

    if (document.pictureInPictureElement === video) {
      try {
        await document.exitPictureInPicture()
      } catch (err) {
        console.error('Error exiting PiP:', err)
      }
    }

    if ((video as any).webkitPresentationMode === 'picture-in-picture') {
      try {
        ;(video as any).webkitSetPresentationMode('inline')
      } catch (err) {
        console.error('Error exiting Safari PiP:', err)
      }
    }

    this.currentVideo = null
  }

  async clearPiP() {
    await this.exitPiPIfActive()
    this.onPiPExitCallback?.()
    this.onPiPExitCallback = null
    this.currentVideo = null
  }

  clearCurrent(video: HTMLVideoElement) {
    if (this.currentVideo === video) {
      this.currentVideo = null
      this.onPiPExitCallback = null
    }
  }

  setPiPCallback(callback: PiPCallback | null) {
    this.onPiPExitCallback = callback ?? null
  }
}

export default new VideoManager()

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

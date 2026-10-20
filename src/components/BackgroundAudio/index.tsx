import mediaManager from '@/services/media-manager.service'
import { useEffect, useState } from 'react'
import AudioPlayer from '../AudioPlayer'

type BackgroundAudioSource = { src: string; time?: number; pubkey?: string }

export default function BackgroundAudio({ className }: { className?: string }) {
  const [{ source, requestId }, setPlayback] = useState<{
    source: BackgroundAudioSource | null
    requestId: number
  }>({ source: null, requestId: 0 })

  useEffect(() => {
    const handlePlayAudioBackground = (event: Event) => {
      const next = (event as CustomEvent<BackgroundAudioSource>).detail
      // Each event explicitly transfers playback from an inline player. A fresh
      // player applies the latest seek position and autoplay, even for the same URL/time.
      setPlayback((previous) => ({ source: next, requestId: previous.requestId + 1 }))
    }
    const handleStopAudioBackground = () =>
      setPlayback((previous) => ({ ...previous, source: null }))

    mediaManager.addEventListener('playAudioBackground', handlePlayAudioBackground)
    mediaManager.addEventListener('stopAudioBackground', handleStopAudioBackground)
    return () => {
      mediaManager.removeEventListener('playAudioBackground', handlePlayAudioBackground)
      mediaManager.removeEventListener('stopAudioBackground', handleStopAudioBackground)
    }
  }, [])

  return source ? (
    <AudioPlayer
      key={requestId}
      src={source.src}
      pubkey={source.pubkey}
      className={className}
      startTime={source.time}
      autoPlay
      isMinimized
    />
  ) : null
}

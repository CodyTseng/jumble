import mediaManager from '@/services/media-manager.service'
import { useEffect, useState } from 'react'
import AudioPlayer from '../AudioPlayer'

export default function BackgroundAudio({ className }: { className?: string }) {
  const [backgroundAudioSrc, setBackgroundAudioSrc] = useState<string | null>(null)
  const [backgroundAudio, setBackgroundAudio] = useState<React.ReactNode>(null)

  useEffect(() => {
    const handlePlayAudioBackground = (event: Event) => {
      const { src, time } = (event as CustomEvent).detail
      if (backgroundAudioSrc === src) return

      setBackgroundAudio(
        <FloatingAudioPlayer key={src + time} src={src} time={time} className={className} />
      )
      setBackgroundAudioSrc(src)
    }

    const handleStopAudioBackground = () => {
      setBackgroundAudio(null)
    }

    mediaManager.addEventListener('playAudioBackground', handlePlayAudioBackground)
    mediaManager.addEventListener('stopAudioBackground', handleStopAudioBackground)

    return () => {
      mediaManager.removeEventListener('playAudioBackground', handlePlayAudioBackground)
      mediaManager.removeEventListener('stopAudioBackground', handleStopAudioBackground)
    }
  }, [])

  return backgroundAudio
}

function FloatingAudioPlayer({
  src,
  time,
  className
}: {
  src: string
  time?: number
  className?: string
}) {
  return <AudioPlayer src={src} className={className} startTime={time} autoPlay isMinimized />
}

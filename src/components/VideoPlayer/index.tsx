import { cn } from '@/lib/utils'
import NsfwOverlay from '../NsfwOverlay'
import { useEffect, useRef, useState } from 'react'

export default function VideoPlayer({
  src,
  className,
  isNsfw = false,
  size = 'normal'
}: {
  src: string
  className?: string
  isNsfw?: boolean
  size?: 'normal' | 'small'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return

    const handlePlay = () => {
      setHasPlayed(true)
    }

    videoEl.addEventListener('play', handlePlay)

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.5 }
    )

    observer.observe(videoEl)

    return () => {
      videoEl.removeEventListener('play', handlePlay)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !hasPlayed) return

    // Automatically enter PiP when out of view
    if (!isVisible && document.pictureInPictureEnabled && !videoEl.disablePictureInPicture) {
      if (document.pictureInPictureElement !== videoEl) {
        videoEl.requestPictureInPicture().catch((err) => console.error('Failed to enter PiP:', err))
      }
    }

    // Automatically exit PiP when back in view
    if (isVisible && document.pictureInPictureElement === videoEl) {
      document.exitPictureInPicture().catch((err) => console.error('Failed to exit PiP:', err))
    }
  }, [isVisible, hasPlayed])

  return (
    <>
      <div className="relative">
        <video
          ref={videoRef}
          controls
          className={cn('rounded-lg', size === 'small' ? 'h-[15vh]' : 'h-[30vh]', className)}
          src={src}
          onClick={(e) => e.stopPropagation()}
        />
        {isNsfw && <NsfwOverlay className="rounded-lg" />}
      </div>
    </>
  )
}

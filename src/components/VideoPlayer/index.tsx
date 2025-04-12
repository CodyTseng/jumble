import { cn } from '@/lib/utils'
import NsfwOverlay from '../NsfwOverlay'
import { useEffect, useRef } from 'react'
import VideoManager from '@/services/videomanager'

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
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current

    if (!video || !container) return

    const observer = new IntersectionObserver(
      async ([entry]) => {
        const isVisible = entry.isIntersecting

        if (!isVisible && !video.paused) {
          await VideoManager.enterPiP(video)
        }

        if (isVisible) {
          if (
            document.pictureInPictureElement === video ||
            (video as any).webkitPresentationMode === 'picture-in-picture'
          ) {
            await VideoManager.exitPiP(video)
          }
        }
      },
      {
        threshold: 0.5
      }
    )

    observer.observe(container)

    return () => {
      observer.unobserve(container)
    }
  }, [])

  const handlePlay = async () => {
    const video = videoRef.current
    if (!video) return

    await VideoManager.playVideo(video)
  }
  return (
    <>
      <div ref={containerRef} className="relative">
        <video
          ref={videoRef}
          controls
          className={cn('rounded-lg', size === 'small' ? 'h-[15vh]' : 'h-[30vh]', className)}
          src={src}
          onClick={(e) => e.stopPropagation()}
          onPlay={handlePlay}
        />
        {isNsfw && <NsfwOverlay className="rounded-lg" />}
      </div>
    </>
  )
}

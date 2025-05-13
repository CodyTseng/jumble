import { cn, isInViewport } from '@/lib/utils'
import { useAutoplay } from '@/providers/AutoplayProvider'
import videoManager from '@/services/video-manager.service'
import { useEffect, useRef } from 'react'
import NsfwOverlay from '../NsfwOverlay'

export default function VideoPlayer({
  src,
  className,
  isNsfw = false
}: {
  src: string
  className?: string
  isNsfw?: boolean
}) {
  const { autoplay } = useAutoplay()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoplay) return

    const video = videoRef.current
    const container = containerRef.current

    if (!video || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            if (isInViewport(container)) {
              videoManager.autoPlay(video)
            }
          }, 200)
        } else {
          videoManager.pause(video)
        }
      },
      { threshold: 1 }
    )

    observer.observe(container)

    return () => {
      observer.unobserve(container)
    }
  }, [autoplay])

  return (
    <div ref={containerRef} className="relative">
      <video
        ref={videoRef}
        controls
        playsInline
        className={cn('rounded-lg max-h-[80vh] sm:max-h-[50vh] border', className)}
        src={src}
        onClick={(e) => e.stopPropagation()}
        onPlay={(event) => {
          videoManager.play(event.currentTarget)
        }}
        muted
      />
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </div>
  )
}

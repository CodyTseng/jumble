import { cn, isInViewport } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import mediaManager from '@/services/media-manager.service'
import { useEffect, useRef, useState } from 'react'
import ExternalLink from '../ExternalLink'

export default function VideoPlayer({
  src,
  className,
  loop = false,
  defaultMuted
}: {
  src: string
  className?: string
  loop?: boolean
  defaultMuted?: boolean
}) {
  const { autoplay } = useContentPolicy()
  const { muteMedia, updateMuteMedia } = useUserPreferences()
  // Use defaultMuted if provided, otherwise fall back to global muteMedia setting
  const effectiveMuted = defaultMuted !== undefined ? defaultMuted : muteMedia
  const [error, setError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current

    if (!video || !container || error) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && autoplay) {
          setTimeout(() => {
            if (isInViewport(container)) {
              mediaManager.autoPlay(video)
            }
          }, 200)
        }

        if (!entry.isIntersecting) {
          mediaManager.pause(video)
        }
      },
      { threshold: 1 }
    )

    observer.observe(container)

    return () => {
      observer.unobserve(container)
    }
  }, [autoplay, error])

  useEffect(() => {
    if (!videoRef.current) return

    const video = videoRef.current

    const handleVolumeChange = () => {
      updateMuteMedia(video.muted)
    }

    video.addEventListener('volumechange', handleVolumeChange)

    return () => {
      video.removeEventListener('volumechange', handleVolumeChange)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Only sync with global muteMedia when defaultMuted is not set
    if (defaultMuted === undefined && video.muted !== muteMedia) {
      video.muted = muteMedia
    }
  }, [muteMedia, defaultMuted])

  if (error) {
    return <ExternalLink url={src} />
  }

  return (
    <div ref={containerRef}>
      <video
        ref={videoRef}
        controls
        playsInline
        loop={loop}
        className={cn('rounded-lg max-h-[80vh] sm:max-h-[60vh] border', className)}
        src={src}
        onClick={(e) => e.stopPropagation()}
        onPlay={(event) => {
          mediaManager.play(event.currentTarget)
        }}
        muted={effectiveMuted}
        onError={() => setError(true)}
      />
    </div>
  )
}

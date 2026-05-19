import { isInsecureUrl } from '@/lib/url'
import { cn, isInViewport } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import mediaManager from '@/services/media-manager.service'
import { useEffect, useRef, useState } from 'react'
import ExternalLink from '../ExternalLink'

export default function VideoPlayer({
  src,
  className,
  dim
}: {
  src: string
  className?: string
  dim?: { width: number; height: number }
}) {
  const { autoplay, videoLoop } = useContentPolicy()
  const { muteMedia, updateMuteMedia, allowInsecureConnection } = useUserPreferences()
  const [error, setError] = useState(false)
  const [intrinsicDim, setIntrinsicDim] = useState<{ width: number; height: number } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIntrinsicDim(null)
  }, [src])

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
    if (!video || video.muted === muteMedia) return

    if (muteMedia) {
      video.muted = true
    } else {
      video.muted = false
    }
  }, [muteMedia])

  if (error || (!allowInsecureConnection && isInsecureUrl(src))) {
    return <ExternalLink url={src} />
  }

  const effectiveDim = intrinsicDim ?? dim
  const aspectRatio =
    effectiveDim?.width && effectiveDim?.height
      ? `${effectiveDim.width} / ${effectiveDim.height}`
      : '16 / 9'

  return (
    <div
      ref={containerRef}
      className={cn(
        'block w-full overflow-hidden rounded-xl border bg-black sm:h-[40vh] sm:w-auto sm:max-w-full',
        className
      )}
      style={{ aspectRatio }}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        loop={videoLoop}
        className="block h-full w-full object-contain"
        src={src}
        onClick={(e) => e.stopPropagation()}
        onPlay={(event) => {
          mediaManager.play(event.currentTarget)
        }}
        onLoadedMetadata={(event) => {
          const v = event.currentTarget
          if (v.videoWidth > 0 && v.videoHeight > 0) {
            setIntrinsicDim({ width: v.videoWidth, height: v.videoHeight })
          }
        }}
        muted={muteMedia}
        onError={() => setError(true)}
      />
    </div>
  )
}

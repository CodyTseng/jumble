import { cn, isInViewport } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import mediaManager from '@/services/media-manager.service'
import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'
import { Play, ExternalLink as ExternalLinkIcon } from 'lucide-react'

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
  const hlsRef = useRef<Hls | null>(null)

  // Check if the source is an HLS stream (only .m3u8 files)
  const isHls = src.includes('.m3u8')

  // Setup HLS.js for .m3u8 streams
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHls) return

    // If native HLS is supported (Safari), use it directly
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    // Use HLS.js for other browsers
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError(true)
        }
      })

      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    } else {
      // HLS not supported at all
      setError(true)
    }
  }, [src, isHls])

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
      // Only sync to global state when defaultMuted is not explicitly set
      // This allows videos with explicit defaultMuted to maintain their own state
      if (defaultMuted === undefined) {
        updateMuteMedia(video.muted)
      }
    }

    video.addEventListener('volumechange', handleVolumeChange)

    return () => {
      video.removeEventListener('volumechange', handleVolumeChange)
    }
  }, [defaultMuted, updateMuteMedia])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (defaultMuted !== undefined) {
      // When defaultMuted is explicitly set, use that value
      video.muted = defaultMuted
    } else if (video.muted !== muteMedia) {
      // Otherwise sync with global muteMedia
      video.muted = muteMedia
    }
  }, [muteMedia, defaultMuted])

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-muted/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/70 transition-colors',
          className
        )}
        style={{ aspectRatio: '16/9' }}
        onClick={(e) => {
          e.stopPropagation()
          window.open(src, '_blank', 'noreferrer')
        }}
      >
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Play className="w-7 h-7 text-primary fill-primary ml-1" />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLinkIcon className="w-3 h-3" />
          <span>Open video externally</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <video
        ref={videoRef}
        controls
        playsInline
        loop={loop}
        className={cn('rounded-lg max-h-[80vh] sm:max-h-[60vh] border', className)}
        src={isHls ? undefined : src}
        onClick={(e) => e.stopPropagation()}
        onPlay={(event) => {
          mediaManager.play(event.currentTarget)
        }}
        muted={effectiveMuted}
        onError={() => !isHls && setError(true)}
      />
    </div>
  )
}

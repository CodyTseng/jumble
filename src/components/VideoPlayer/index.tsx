import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useBlossomUrl } from '@/hooks/useBlossomUrl'
import { blurFocusedTextInput, cn, isInViewport } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import mediaManager from '@/services/media-manager.service'
import { SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExternalLink from '../ExternalLink'

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export default function VideoPlayer({
  src,
  pubkey,
  className,
  dim
}: {
  src: string
  pubkey?: string
  className?: string
  dim?: { width: number; height: number }
}) {
  const { t } = useTranslation()
  const { autoplay, videoLoop } = useContentPolicy()
  const { muteMedia, updateMuteMedia } = useUserPreferences()
  const { url: videoUrl, error, handleError, markSuccess } = useBlossomUrl(src, pubkey)
  const [intrinsicDim, setIntrinsicDim] = useState<{ width: number; height: number } | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Native controls expose no visibility event; mirror their idle behavior.
  const showControls = useCallback(() => {
    clearTimeout(hideControlsTimeoutRef.current)
    setControlsVisible(true)
    if (isPlaying && !speedMenuOpen) {
      hideControlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 2500)
    }
  }, [isPlaying, speedMenuOpen])

  useEffect(() => {
    showControls()
    return () => clearTimeout(hideControlsTimeoutRef.current)
  }, [showControls])

  useEffect(() => {
    setIntrinsicDim(null)
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.defaultPlaybackRate = playbackRate
    video.playbackRate = playbackRate
  }, [playbackRate, videoUrl, error])

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current

    if (!video || !container || error) return

    let autoPlayTimeout: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        mediaManager.cancelAutoPlay(video)
        if (entry.isIntersecting && autoplay) {
          clearTimeout(autoPlayTimeout)
          autoPlayTimeout = setTimeout(() => {
            if (isInViewport(container)) {
              mediaManager.autoPlay(video, () => isInViewport(container))
            }
          }, 200)
        }

        if (!entry.isIntersecting) {
          clearTimeout(autoPlayTimeout)
          mediaManager.pause(video)
        }
      },
      { threshold: 1 }
    )

    observer.observe(container)

    return () => {
      clearTimeout(autoPlayTimeout)
      mediaManager.cancelAutoPlay(video)
      observer.disconnect()
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

  if (error) {
    return <ExternalLink url={src} />
  }

  const effectiveDim = intrinsicDim ?? dim
  const aspectRatio =
    effectiveDim?.width && effectiveDim?.height
      ? `${effectiveDim.width} / ${effectiveDim.height}`
      : '16 / 9'
  const handleMediaInteraction = (event: SyntheticEvent<HTMLVideoElement>) => {
    blurFocusedTextInput()
    event.stopPropagation()
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative block w-full overflow-hidden rounded-xl border bg-black sm:h-[40vh] sm:w-auto sm:max-w-full',
        className
      )}
      style={{ aspectRatio }}
      onPointerMove={showControls}
      onPointerDownCapture={showControls}
      onFocusCapture={showControls}
      onPointerLeave={(event) => {
        // Touch pointers leave when the finger lifts; keep the idle timeout running.
        if (event.pointerType === 'mouse' && isPlaying && !speedMenuOpen) {
          clearTimeout(hideControlsTimeoutRef.current)
          setControlsVisible(false)
        }
      }}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        loop={videoLoop}
        className="block h-full w-full object-contain"
        src={videoUrl}
        onPointerDown={handleMediaInteraction}
        onTouchStart={handleMediaInteraction}
        onClick={handleMediaInteraction}
        onPlay={(event) => {
          setIsPlaying(true)
          mediaManager.registerPlaying(event.currentTarget)
        }}
        onPause={(event) => {
          setIsPlaying(false)
          mediaManager.registerPaused(event.currentTarget)
        }}
        onEnded={(event) => {
          setIsPlaying(false)
          mediaManager.registerPaused(event.currentTarget)
        }}
        onRateChange={(event) => {
          setPlaybackRate(event.currentTarget.playbackRate)
        }}
        onLoadedMetadata={(event) => {
          const v = event.currentTarget
          if (v.videoWidth > 0 && v.videoHeight > 0) {
            setIntrinsicDim({ width: v.videoWidth, height: v.videoHeight })
          }
          markSuccess()
        }}
        muted={muteMedia}
        onError={handleError}
      />
      <DropdownMenu open={speedMenuOpen} onOpenChange={setSpeedMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('Playback speed')}
            title={t('Playback speed')}
            onPointerDown={blurFocusedTextInput}
            className={cn(
              'absolute end-2 top-2 cursor-pointer border-0 bg-transparent px-2 py-1 text-sm font-medium text-white transition-opacity [text-shadow:0_1px_3px_rgb(0_0_0/80%)] focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white',
              controlsVisible || speedMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          >
            {playbackRate}x
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
          <DropdownMenuLabel>{t('Playback speed')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(playbackRate)}
            onValueChange={(value) => setPlaybackRate(Number(value))}
          >
            {PLAYBACK_RATES.map((rate) => (
              <DropdownMenuRadioItem key={rate} value={String(rate)}>
                {rate}x
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

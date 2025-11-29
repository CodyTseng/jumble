import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AudioPlayer from '../AudioPlayer'
import VideoPlayer from '../VideoPlayer'
import ExternalLink from '../ExternalLink'

// Audio file extensions
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'opus', 'wma']

// Video file extensions (including HLS)
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm3u8']

/**
 * Check if a URL is an HLS stream
 */
function isHlsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.toLowerCase().endsWith('.m3u8')
  } catch {
    return url.toLowerCase().includes('.m3u8')
  }
}

export default function MediaPlayer({
  src,
  className,
  mustLoad = false,
  loop = false,
  defaultMuted
}: {
  src: string
  className?: string
  mustLoad?: boolean
  loop?: boolean
  defaultMuted?: boolean
}) {
  const { t } = useTranslation()
  const { autoLoadMedia } = useContentPolicy()
  const [display, setDisplay] = useState(autoLoadMedia)
  const [mediaType, setMediaType] = useState<'video' | 'audio' | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (autoLoadMedia) {
      setDisplay(true)
    } else {
      setDisplay(false)
    }
  }, [autoLoadMedia])

  useEffect(() => {
    if (!mustLoad && !display) {
      setMediaType(null)
      return
    }
    if (!src) {
      setMediaType(null)
      return
    }

    try {
      const url = new URL(src)
      const extension = url.pathname.split('.').pop()?.toLowerCase()

      // Check for audio extensions
      if (extension && AUDIO_EXTENSIONS.includes(extension)) {
        setMediaType('audio')
        return
      }

      // Check for video extensions (including HLS .m3u8)
      // HLS streams need special handling - they can't be detected via video element
      if (extension && VIDEO_EXTENSIONS.includes(extension)) {
        setMediaType('video')
        return
      }
    } catch {
      // Invalid URL - continue with detection
    }

    // For HLS URLs, always treat as video (VideoPlayer handles HLS via hls.js)
    if (isHlsUrl(src)) {
      setMediaType('video')
      return
    }

    // For unknown extensions, try to detect via video element metadata
    const video = document.createElement('video')
    video.src = src
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    video.onloadedmetadata = () => {
      setError(false)
      setMediaType(video.videoWidth > 0 || video.videoHeight > 0 ? 'video' : 'audio')
    }

    video.onerror = () => {
      setError(true)
    }

    return () => {
      video.src = ''
    }
  }, [src, display, mustLoad])

  if (error) {
    return <ExternalLink url={src} />
  }

  if (!mustLoad && !display) {
    return (
      <div
        className="text-primary hover:underline truncate w-fit cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          setDisplay(true)
        }}
      >
        [{t('Click to load media')}]
      </div>
    )
  }

  if (!mediaType) {
    return null
  }

  if (mediaType === 'video') {
    return <VideoPlayer src={src} className={className} loop={loop} defaultMuted={defaultMuted} />
  }

  return <AudioPlayer src={src} className={className} />
}

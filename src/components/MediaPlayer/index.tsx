import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AudioPlayer from '../AudioPlayer'
import VideoPlayer from '../VideoPlayer'
import ExternalLink from '../ExternalLink'

export default function MediaPlayer({
  src,
  className,
  mustLoad = false
}: {
  src: string
  className?: string
  mustLoad?: boolean
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

    const url = new URL(src)
    const extension = url.pathname.split('.').pop()?.toLowerCase()

    if (extension && ['mp3', 'wav', 'flac', 'aac', 'm4a', 'opus', 'wma'].includes(extension)) {
      setMediaType('audio')
      return
    }

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
    return <VideoPlayer src={src} className={className} />
  }

  return <AudioPlayer src={src} className={className} />
}

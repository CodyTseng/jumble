import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import blossomService from '@/services/blossom.service'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AudioPlayer from '../AudioPlayer'
import VideoPlayer from '../VideoPlayer'
import ExternalLink from '../ExternalLink'

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'opus', 'wma']

function probeMediaType(url: string): Promise<'video' | 'audio' | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = url
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    const cleanup = () => {
      video.onloadedmetadata = null
      video.onerror = null
      video.src = ''
    }

    video.onloadedmetadata = () => {
      const type = video.videoWidth > 0 || video.videoHeight > 0 ? 'video' : 'audio'
      cleanup()
      resolve(type)
    }
    video.onerror = () => {
      cleanup()
      resolve(null)
    }
  })
}

export default function MediaPlayer({
  src,
  pubkey,
  className,
  mustLoad = false,
  dim
}: {
  src: string
  pubkey?: string
  className?: string
  mustLoad?: boolean
  dim?: { width: number; height: number }
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

    let cancelled = false
    setError(false)

    const detect = async () => {
      let extension: string | undefined
      try {
        extension = new URL(src).pathname.split('.').pop()?.toLowerCase()
      } catch {
        // ignore
      }
      if (extension && AUDIO_EXTENSIONS.includes(extension)) {
        if (!cancelled) setMediaType('audio')
        return
      }

      let probeUrl = pubkey ? await blossomService.getValidUrl(src, pubkey) : src
      if (cancelled) return

      while (!cancelled) {
        const type = await probeMediaType(probeUrl)
        if (cancelled) return
        if (type) {
          setMediaType(type)
          blossomService.markAsSuccess(src, probeUrl)
          return
        }
        const nextUrl = pubkey ? await blossomService.tryNextUrl(src) : null
        if (cancelled) return
        if (!nextUrl) {
          setError(true)
          return
        }
        probeUrl = nextUrl
      }
    }

    detect()

    return () => {
      cancelled = true
    }
  }, [src, pubkey, display, mustLoad])

  if (error) {
    return <ExternalLink url={src} />
  }

  if (!mustLoad && !display) {
    return (
      <div
        className="text-primary w-fit cursor-pointer truncate hover:underline"
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
    return (
      <div
        className={cn(
          'bg-muted block w-full overflow-hidden rounded-xl border sm:h-[40vh] sm:w-auto sm:max-w-full',
          className
        )}
        style={{
          aspectRatio: dim?.width && dim?.height ? `${dim.width} / ${dim.height}` : '16 / 9'
        }}
      />
    )
  }

  if (mediaType === 'video') {
    return <VideoPlayer src={src} pubkey={pubkey} className={className} dim={dim} />
  }

  return <AudioPlayer src={src} pubkey={pubkey} className={className} />
}

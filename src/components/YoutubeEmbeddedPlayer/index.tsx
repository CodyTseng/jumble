import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExternalLink from '../ExternalLink'
import Player from './Player'

export default function YoutubeEmbeddedPlayer({
  url,
  className,
  mustLoad = false
}: {
  url: string
  className?: string
  mustLoad?: boolean
}) {
  const { t } = useTranslation()
  const { autoLoadMedia } = useContentPolicy()
  const [display, setDisplay] = useState(autoLoadMedia || mustLoad)
  const { videoId, isShort } = useMemo(() => parseYoutubeUrl(url), [url])

  useEffect(() => {
    if (autoLoadMedia || mustLoad) {
      setDisplay(true)
    }
  }, [autoLoadMedia, mustLoad])

  if (!videoId) {
    return <ExternalLink url={url} />
  }

  if (!display) {
    return (
      <div
        className="text-primary hover:underline truncate w-fit cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          setDisplay(true)
        }}
      >
        [{t('Click to load YouTube video')}]
      </div>
    )
  }

  return <Player videoId={videoId} isShort={isShort} className={className} />
}

function parseYoutubeUrl(url: string) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/live\/([^&\n?#]+)/
  ]

  let videoId: string | null = null
  let isShort = false
  for (const [index, pattern] of patterns.entries()) {
    const match = url.match(pattern)
    if (match) {
      videoId = match[1].trim()
      isShort = index === 2 // Check if it's a short video
      break
    }
  }
  return { videoId, isShort }
}

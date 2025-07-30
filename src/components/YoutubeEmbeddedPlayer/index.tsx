import { cn } from '@/lib/utils'
import { useMemo } from 'react'

export default function YoutubeEmbeddedPlayer({
  url,
  className
}: {
  url: string
  className?: string
}) {
  const videoId = useMemo(() => extractVideoId(url), [url])
  const embedUrl = useMemo(() => (videoId ? youtubeEmbeddedUrl(videoId) : null), [videoId])

  if (!embedUrl) {
    return (
      <a
        href={url}
        className="text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {url}
      </a>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg max-h-[80vh] sm:max-h-[50vh] border aspect-video overflow-hidden',
        className
      )}
    >
      <iframe
        src={embedUrl}
        className="w-full aspect-video"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  )
}

function youtubeEmbeddedUrl(id: string) {
  return `https://www.youtube.com/embed/${id}`
}

function extractVideoId(url: string) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

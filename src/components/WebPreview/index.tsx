import { useFetchWebMetadata } from '@/hooks/useFetchWebMetadata'
import { cn } from '@/lib/utils'
import { isYouTubeURL, extractVideoId, youtubeEmbdedURL } from '@/lib/url'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useMemo } from 'react'
import Image from '../Image'

export default function WebPreview({ url, className }: { url: string; className?: string }) {
  const { isSmallScreen } = useScreenSize()
  const { title, description, image } = useFetchWebMetadata(url)

  // Check if it's a YouTube URL
  const isYouTube = isYouTubeURL(url)
  const videoId = isYouTube ? extractVideoId(url) : null

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }, [url])

  // If it's a YouTube video with valid ID, render iframe
  if (isYouTube && videoId) {
    const embedUrl = youtubeEmbdedURL(videoId)

    if (isSmallScreen) {
      return (
        <div className="rounded-lg border mt-2 overflow-hidden">
          <iframe
            src={embedUrl}
            className="w-full h-44 rounded-t-lg"
            allowFullScreen
            title="YouTube video"
          />
          <div className="bg-muted p-2 w-full rounded-b-lg">
            <div className="text-xs text-muted-foreground">youtube.com</div>
            <div className="font-semibold line-clamp-1">{title || 'YouTube Video'}</div>
          </div>
        </div>
      )
    }

    return (
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        <iframe
          src={embedUrl}
          className="w-full aspect-video"
          allowFullScreen
          title="YouTube video"
        />
        <div className="p-2">
          <div className="text-xs text-muted-foreground">youtube.com</div>
          <div className="font-semibold line-clamp-2">{title || 'YouTube Video'}</div>
          {description && (
            <div className="text-xs text-muted-foreground line-clamp-3">{description}</div>
          )}
        </div>
      </div>
    )
  }

  if (!title) {
    return null
  }

  if (isSmallScreen && image) {
    return (
      <div
        className="rounded-lg border mt-2"
        onClick={(e) => {
          e.stopPropagation()
          window.open(url, '_blank')
        }}
      >
        <Image image={{ url: image }} className="w-full h-44 rounded-t-lg" hideIfError />
        <div className="bg-muted p-2 w-full rounded-b-lg">
          <div className="text-xs text-muted-foreground">{hostname}</div>
          <div className="font-semibold line-clamp-1">{title}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('p-0 clickable flex w-full border rounded-lg', className)}
      onClick={(e) => {
        e.stopPropagation()
        window.open(url, '_blank')
      }}
    >
      {image && (
        <Image
          image={{ url: image }}
          className="rounded-lg aspect-[4/3] xl:aspect-video object-cover bg-foreground h-44"
          hideIfError
        />
      )}
      <div className="flex-1 w-0 p-2">
        <div className="text-xs text-muted-foreground">{hostname}</div>
        <div className="font-semibold line-clamp-2">{title}</div>
        <div className="text-xs text-muted-foreground line-clamp-5">{description}</div>
      </div>
    </div>
  )
}

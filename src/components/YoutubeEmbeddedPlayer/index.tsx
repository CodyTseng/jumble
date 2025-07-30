import { cn } from '@/lib/utils'
import mediaManager from '@/services/media-manager.service'
import { YouTubePlayer } from '@/types/youtube'
import { useEffect, useMemo, useRef } from 'react'

export default function YoutubeEmbeddedPlayer({
  url,
  className
}: {
  url: string
  className?: string
}) {
  const videoId = useMemo(() => extractVideoId(url), [url])
  const playerRef = useRef<YouTubePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!videoId || !containerRef.current) return

    if (!window.YT) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)

      window.onYouTubeIframeAPIReady = () => {
        initPlayer()
      }
    } else {
      initPlayer()
    }

    function initPlayer() {
      if (!videoId || !containerRef.current) return
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: videoId,
        events: {
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              mediaManager.play(playerRef.current)
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              mediaManager.pause(playerRef.current)
            }
          }
        }
      })
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
  }, [videoId])

  if (!videoId) {
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
    <div className={cn('rounded-lg border overflow-hidden w-full aspect-video', className)}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
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

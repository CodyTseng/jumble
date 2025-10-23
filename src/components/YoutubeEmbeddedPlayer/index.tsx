import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import mediaManager from '@/services/media-manager.service'
import { YouTubePlayer } from '@/types/youtube'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExternalLink from '../ExternalLink'

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
  const { muteMedia, updateMuteMedia } = useUserPreferences()
  const [display, setDisplay] = useState(autoLoadMedia)
  const { videoId, isShort } = useMemo(() => parseYoutubeUrl(url), [url])
  const [initSuccess, setInitSuccess] = useState(false)
  const [error, setError] = useState(false)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const muteStateRef = useRef(muteMedia)

  useEffect(() => {
    if (autoLoadMedia) {
      setDisplay(true)
    } else {
      setDisplay(false)
    }
  }, [autoLoadMedia])

  useEffect(() => {
    if (!videoId || !containerRef.current || (!mustLoad && !display)) return

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

    let checkMutedInterval: NodeJS.Timeout | null = null
    function initPlayer() {
      try {
        if (!videoId || !containerRef.current || !window.YT.Player) return

        let currentMuteState = muteStateRef.current
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            mute: currentMuteState ? 1 : 0
          },
          events: {
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                mediaManager.play(playerRef.current)
              } else if (
                event.data === window.YT.PlayerState.PAUSED ||
                event.data === window.YT.PlayerState.ENDED
              ) {
                mediaManager.pause(playerRef.current)
              }
            },
            onReady: () => {
              setInitSuccess(true)
              checkMutedInterval = setInterval(() => {
                if (playerRef.current) {
                  const mute = playerRef.current.isMuted()
                  if (mute !== currentMuteState) {
                    currentMuteState = mute

                    if (mute !== muteStateRef.current) {
                      updateMuteMedia(currentMuteState)
                    }
                  } else if (muteStateRef.current !== mute) {
                    if (muteStateRef.current) {
                      playerRef.current.mute()
                    } else {
                      playerRef.current.unMute()
                    }
                  }
                }
              }, 200)
            },
            onError: () => setError(true)
          }
        })
      } catch (error) {
        console.error('Failed to initialize YouTube player:', error)
        setError(true)
        return
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }
      if (checkMutedInterval) {
        clearInterval(checkMutedInterval)
        checkMutedInterval = null
      }
    }
  }, [videoId, display, mustLoad])

  useEffect(() => {
    muteStateRef.current = muteMedia
  }, [muteMedia])

  useEffect(() => {
    const wrapper = wrapperRef.current

    if (!wrapper || !initSuccess) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const player = playerRef.current
        if (!player) return

        if (
          !entry.isIntersecting &&
          [window.YT.PlayerState.PLAYING, window.YT.PlayerState.BUFFERING].includes(
            player.getPlayerState()
          )
        ) {
          mediaManager.pause(player)
        }
      },
      { threshold: 1 }
    )

    observer.observe(wrapper)

    return () => {
      observer.unobserve(wrapper)
    }
  }, [videoId, display, mustLoad, initSuccess])

  if (error) {
    return <ExternalLink url={url} />
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
        [{t('Click to load YouTube video')}]
      </div>
    )
  }

  if (!videoId && !initSuccess) {
    return <ExternalLink url={url} />
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'rounded-lg border overflow-hidden',
        isShort ? 'aspect-[9/16] max-h-[80vh] sm:max-h-[60vh]' : 'aspect-video max-h-[60vh]',
        className
      )}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
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

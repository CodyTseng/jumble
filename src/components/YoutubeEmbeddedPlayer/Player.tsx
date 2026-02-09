import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import mediaManager from '@/services/media-manager.service'
import { YouTubePlayer } from '@/types/youtube'
import { memo, useEffect, useRef, useState } from 'react'

let ytApiReady = false
const ytApiCallbacks: (() => void)[] = []

function ensureYTApi(callback: () => void) {
  if (ytApiReady && window.YT?.Player) {
    callback()
    return
  }

  ytApiCallbacks.push(callback)

  if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.body.appendChild(script)

    window.onYouTubeIframeAPIReady = () => {
      ytApiReady = true
      ytApiCallbacks.forEach((cb) => cb())
      ytApiCallbacks.length = 0
    }
  }
}

interface PlayerProps {
  videoId: string
  isShort: boolean
  className?: string
}

const Player = memo(({ videoId, isShort, className }: PlayerProps) => {
  const { muteMedia, updateMuteMedia } = useUserPreferences()
  const [initSuccess, setInitSuccess] = useState(false)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const muteStateRef = useRef(muteMedia)
  const playerIdRef = useRef(`yt-player-${Math.random().toString(36).substr(2, 9)}`)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    if (!videoId || !containerRef.current) return

    ensureYTApi(() => {
      if (!unmountedRef.current) {
        initPlayer()
      }
    })

    let checkMutedInterval: NodeJS.Timeout | null = null
    function initPlayer() {
      try {
        if (!videoId || !containerRef.current || !window.YT.Player || unmountedRef.current) return

        let currentMuteState = muteStateRef.current
        // Use string ID to avoid React DOM manipulation conflicts
        playerRef.current = new window.YT.Player(playerIdRef.current as any, {
          videoId: videoId,
          playerVars: {
            mute: currentMuteState ? 1 : 0
          },
          events: {
            onStateChange: (event: any) => {
              if (unmountedRef.current) return

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
              if (unmountedRef.current) {
                playerRef.current?.destroy()
                return
              }
              setInitSuccess(true)
              checkMutedInterval = setInterval(() => {
                if (playerRef.current && !unmountedRef.current) {
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
            onError: () => {
              if (unmountedRef.current) return
              console.error('YouTube player error')
            }
          }
        })
      } catch (error) {
        console.error('Failed to initialize YouTube player:', error)
        return
      }
    }

    return () => {
      unmountedRef.current = true
      if (checkMutedInterval) {
        clearInterval(checkMutedInterval)
        checkMutedInterval = null
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {
          // Ignore errors during cleanup
        }
        playerRef.current = null
      }
    }
  }, [videoId])

  useEffect(() => {
    muteStateRef.current = muteMedia
  }, [muteMedia])

  useEffect(() => {
    const wrapper = wrapperRef.current

    if (!wrapper || !initSuccess) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const player = playerRef.current
        if (!player || unmountedRef.current) return

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
  }, [initSuccess])

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'overflow-hidden rounded-xl border',
        isShort ? 'aspect-[9/16] max-h-[80vh] sm:max-h-[60vh]' : 'aspect-video max-h-[60vh]',
        className
      )}
    >
      <div id={playerIdRef.current} ref={containerRef} className="h-full w-full" />
    </div>
  )
})

Player.displayName = 'YoutubePlayer'

export default Player

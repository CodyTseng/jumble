import { getElectronBridge, isElectron } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { YOUTUBE_PLAYER_ORIGIN, YOUTUBE_PLAYER_STATE, parseYouTubeMessage } from '@/lib/youtube'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import mediaManager from '@/services/media-manager.service'
import { YouTubePlayer } from '@/types/youtube'
import { memo, useEffect, useMemo, useRef, useState } from 'react'

interface PlayerProps {
  videoId: string
  isShort: boolean
  className?: string
}

const wrapperClass = (isShort: boolean, className?: string) =>
  cn(
    'overflow-hidden rounded-xl border',
    isShort ? 'aspect-9/16 max-h-[80vh] sm:max-h-[60vh]' : 'aspect-video max-h-[60vh]',
    className
  )

// Web mode talks directly to YouTube's cross-origin embed using the IFrame
// Player postMessage protocol. No YouTube script executes in Jumble's main
// document, so it cannot access application state or an Electron bridge.
const WebPlayer = memo(({ videoId, isShort, className }: PlayerProps) => {
  const { muteMedia, updateMuteMedia } = useUserPreferences()
  const [initSuccess, setInitSuccess] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const playerProxyRef = useRef<YouTubePlayer | null>(null)
  const stateRef = useRef<number>(YOUTUBE_PLAYER_STATE.UNSTARTED)
  const mutedRef = useRef(muteMedia)
  const muteStateRef = useRef(muteMedia)
  const initialMuteRef = useRef(muteMedia)
  const unmountedRef = useRef(false)
  const playerId = useMemo(() => `yt-player-${Math.random().toString(36).slice(2, 11)}`, [])
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      enablejsapi: '1',
      origin: window.location.origin,
      playsinline: '1',
      mute: initialMuteRef.current ? '1' : '0'
    })
    return `${YOUTUBE_PLAYER_ORIGIN}/embed/${encodeURIComponent(videoId)}?${params}`
  }, [videoId])

  useEffect(() => {
    muteStateRef.current = muteMedia
    if (!initSuccess || muteMedia === mutedRef.current) return
    postYouTubeCommand(iframeRef.current, playerId, muteMedia ? 'mute' : 'unMute')
  }, [muteMedia, initSuccess, playerId])

  useEffect(() => {
    unmountedRef.current = false
    setInitSuccess(false)
    stateRef.current = YOUTUBE_PLAYER_STATE.UNSTARTED
    mutedRef.current = initialMuteRef.current

    const post = (func: string, args: unknown[] = []) =>
      postYouTubeCommand(iframeRef.current, playerId, func, args)
    const proxy: YouTubePlayer = {
      destroy: () => post('destroy'),
      playVideo: () => post('playVideo'),
      pauseVideo: () => post('pauseVideo'),
      stopVideo: () => post('stopVideo'),
      // These values are not consumed by MediaManager or any current caller.
      getCurrentTime: () => 0,
      getDuration: () => 0,
      getPlayerState: () => stateRef.current,
      isMuted: () => mutedRef.current,
      mute: () => post('mute'),
      unMute: () => post('unMute')
    }
    playerProxyRef.current = proxy

    let ready = false
    const listen = () => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: playerId }),
        YOUTUBE_PLAYER_ORIGIN
      )
    }
    const listeningInterval = window.setInterval(() => {
      if (ready) {
        window.clearInterval(listeningInterval)
      } else {
        listen()
      }
    }, 500)

    const applyInfo = (info: unknown) => {
      if (!info || typeof info !== 'object') return
      const values = info as { playerState?: number; muted?: boolean }
      if (typeof values.playerState === 'number') {
        updatePlayerState(values.playerState, proxy, stateRef)
      }
      if (typeof values.muted === 'boolean' && values.muted !== mutedRef.current) {
        mutedRef.current = values.muted
        if (values.muted !== muteStateRef.current) updateMuteMedia(values.muted)
      }
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== YOUTUBE_PLAYER_ORIGIN) return
      if (event.source !== iframeRef.current?.contentWindow || unmountedRef.current) return
      const message = parseYouTubeMessage(event.data)
      if (!message || (message.id && message.id !== playerId)) return

      switch (message.event) {
        case 'initialDelivery':
        case 'infoDelivery':
          applyInfo(message.info)
          break
        case 'onReady':
          ready = true
          window.clearInterval(listeningInterval)
          setInitSuccess(true)
          post('addEventListener', ['onStateChange'])
          post('addEventListener', ['onError'])
          post(muteStateRef.current ? 'mute' : 'unMute')
          break
        case 'onStateChange':
          if (typeof message.info === 'number') {
            updatePlayerState(message.info, proxy, stateRef)
          }
          break
        case 'onError':
          console.error('YouTube player error', message.info)
          break
      }
    }

    window.addEventListener('message', onMessage)
    listen()

    return () => {
      unmountedRef.current = true
      window.clearInterval(listeningInterval)
      window.removeEventListener('message', onMessage)
      mediaManager.registerPaused(proxy)
      post('destroy')
      playerProxyRef.current = null
    }
  }, [iframeSrc, playerId, updateMuteMedia])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !initSuccess) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const player = playerProxyRef.current
        if (!player || unmountedRef.current) return
        if (!entry.isIntersecting && isYouTubePlaying(player.getPlayerState())) {
          mediaManager.pause(player)
        }
      },
      { threshold: 1 }
    )

    observer.observe(wrapper)
    return () => observer.unobserve(wrapper)
  }, [initSuccess])

  return (
    <div ref={wrapperRef} className={wrapperClass(isShort, className)}>
      <iframe
        key={videoId}
        ref={iframeRef}
        src={iframeSrc}
        title="YouTube video player"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
        className="block h-full w-full border-0"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        onLoad={() => {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'listening', id: playerId }),
            YOUTUBE_PLAYER_ORIGIN
          )
        }}
      />
    </div>
  )
})
WebPlayer.displayName = 'YoutubeWebPlayer'

// Electron's app:// parent origin is rejected by YouTube (player error 153),
// so its isolated player remains in a loopback-hosted shim. The shim is a
// separate origin, sandboxed here, and has its own restrictive CSP.
const ElectronPlayer = memo(({ videoId, isShort, className }: PlayerProps) => {
  const { muteMedia, updateMuteMedia } = useUserPreferences()
  const [initSuccess, setInitSuccess] = useState(false)
  const [shimOrigin, setShimOrigin] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const playerProxyRef = useRef<YouTubePlayer | null>(null)
  const stateRef = useRef<number>(YOUTUBE_PLAYER_STATE.UNSTARTED)
  const mutedRef = useRef<boolean>(muteMedia)
  const muteStateRef = useRef(muteMedia)
  const unmountedRef = useRef(false)
  const initialMuteRef = useRef(muteMedia)

  useEffect(() => {
    let cancelled = false
    const bridge = getElectronBridge()
    if (!bridge) return
    bridge.media.getShimOrigin().then((origin) => {
      if (!cancelled) setShimOrigin(origin)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    muteStateRef.current = muteMedia
  }, [muteMedia])

  useEffect(() => {
    if (!initSuccess || !shimOrigin || muteMedia === mutedRef.current) return
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'yt-host', type: muteMedia ? 'mute' : 'unmute' },
      shimOrigin
    )
  }, [muteMedia, initSuccess, shimOrigin])

  useEffect(() => {
    unmountedRef.current = false
    if (!shimOrigin) return

    const post = (type: string) => {
      iframeRef.current?.contentWindow?.postMessage({ source: 'yt-host', type }, shimOrigin)
    }

    const proxy: YouTubePlayer = {
      destroy: () => post('destroy'),
      playVideo: () => post('play'),
      pauseVideo: () => post('pause'),
      stopVideo: () => post('stop'),
      getCurrentTime: () => 0,
      getDuration: () => 0,
      getPlayerState: () => stateRef.current,
      isMuted: () => mutedRef.current,
      mute: () => post('mute'),
      unMute: () => post('unmute')
    }
    playerProxyRef.current = proxy

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== shimOrigin) return
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as
        | { source?: string; type?: string; state?: number; muted?: boolean; code?: number }
        | undefined
      if (!data || data.source !== 'yt-shim' || unmountedRef.current) return

      switch (data.type) {
        case 'ready':
          setInitSuccess(true)
          break
        case 'state':
          updatePlayerState(data.state ?? YOUTUBE_PLAYER_STATE.UNSTARTED, proxy, stateRef)
          break
        case 'muted': {
          const mute = !!data.muted
          mutedRef.current = mute
          if (mute !== muteStateRef.current) updateMuteMedia(mute)
          break
        }
        case 'error':
          console.error('YouTube player error', data.code)
          break
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      unmountedRef.current = true
      window.removeEventListener('message', onMessage)
      mediaManager.registerPaused(proxy)
      post('destroy')
      playerProxyRef.current = null
    }
  }, [shimOrigin, videoId, updateMuteMedia])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !initSuccess) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const proxy = playerProxyRef.current
        if (!proxy || unmountedRef.current) return
        if (!entry.isIntersecting && isYouTubePlaying(stateRef.current)) {
          mediaManager.pause(proxy)
        }
      },
      { threshold: 1 }
    )

    observer.observe(wrapper)
    return () => observer.unobserve(wrapper)
  }, [initSuccess])

  const iframeSrc = shimOrigin
    ? `${shimOrigin}/yt-shim.html?videoId=${encodeURIComponent(videoId)}` +
      `&mute=${initialMuteRef.current ? 1 : 0}` +
      `&parentOrigin=${encodeURIComponent(window.location.origin)}`
    : null

  return (
    <div ref={wrapperRef} className={wrapperClass(isShort, className)}>
      {iframeSrc && (
        <iframe
          key={videoId}
          ref={iframeRef}
          src={iframeSrc}
          title="YouTube video player"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          className="block h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      )}
    </div>
  )
})
ElectronPlayer.displayName = 'YoutubeElectronPlayer'

const Player = memo((props: PlayerProps) => {
  return isElectron() ? <ElectronPlayer {...props} /> : <WebPlayer {...props} />
})

Player.displayName = 'YoutubePlayer'

export default Player

function postYouTubeCommand(
  iframe: HTMLIFrameElement | null,
  id: string,
  func: string,
  args: unknown[] = []
) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args, id }),
    YOUTUBE_PLAYER_ORIGIN
  )
}

function updatePlayerState(state: number, player: YouTubePlayer, stateRef: { current: number }) {
  stateRef.current = state
  if (state === YOUTUBE_PLAYER_STATE.PLAYING) {
    mediaManager.registerPlaying(player)
  } else if (state === YOUTUBE_PLAYER_STATE.PAUSED || state === YOUTUBE_PLAYER_STATE.ENDED) {
    mediaManager.registerPaused(player)
  }
}

function isYouTubePlaying(state: number) {
  return state === YOUTUBE_PLAYER_STATE.PLAYING || state === YOUTUBE_PLAYER_STATE.BUFFERING
}

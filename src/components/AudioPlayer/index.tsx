import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import mediaManager from '@/services/media-manager.service'
import { Minimize2, Pause, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ExternalLink from '../ExternalLink'

interface AudioPlayerProps {
  src: string
  autoPlay?: boolean
  startTime?: number
  isMinimized?: boolean
  className?: string
}

export default function AudioPlayer({
  src,
  autoPlay = false,
  startTime,
  isMinimized = false,
  className
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const seekTimeoutRef = useRef<NodeJS.Timeout>()
  const isSeeking = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (startTime) {
      setCurrentTime(startTime)
      audio.currentTime = startTime
    }

    if (autoPlay) {
      togglePlay()
    }

    const updateTime = () => {
      if (!isSeeking.current) {
        setCurrentTime(audio.currentTime)
      }
    }
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)
    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const container = containerRef.current

    if (!audio || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          audio.pause()
        }
      },
      { threshold: 1 }
    )

    observer.observe(container)

    return () => {
      observer.unobserve(container)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
      mediaManager.play(audio)
    }
  }

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    isSeeking.current = true
    setCurrentTime(value[0])

    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current)
    }

    seekTimeoutRef.current = setTimeout(() => {
      audio.currentTime = value[0]
      isSeeking.current = false
    }, 300)
  }

  if (error) {
    return <ExternalLink url={src} />
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center gap-3 py-2 px-2 border rounded-full max-w-md bg-background',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={src} preload="metadata" onError={() => setError(false)} />

      {/* Play/Pause Button */}
      <Button size="icon" className="rounded-full shrink-0" onClick={togglePlay}>
        {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </Button>

      {/* Progress Section */}
      <div className="flex-1 relative">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={handleSeek}
          hideThumb
          enableHoverAnimation
        />
      </div>

      <div className="text-sm font-mono text-muted-foreground">
        {formatTime(Math.max(duration - currentTime, 0))}
      </div>
      {isMinimized ? (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shrink-0 text-muted-foreground"
          onClick={() => mediaManager.stopAudioBackground()}
        >
          <X />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shrink-0 text-muted-foreground"
          onClick={() => mediaManager.playAudioBackground(src, audioRef.current?.currentTime || 0)}
        >
          <Minimize2 />
        </Button>
      )}
    </div>
  )
}

const formatTime = (time: number) => {
  if (time === Infinity || isNaN(time)) {
    return '-:--'
  }
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

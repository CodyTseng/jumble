import { useEffect, useState } from 'react'
import AudioPlayer from './AudioPlayer'
import VideoPlayer from './VideoPlayer'

export default function MediaPlayer({ src, className }: { src: string; className?: string }) {
  const [mediaType, setMediaType] = useState<'video' | 'audio' | null>(null)

  useEffect(() => {
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
      setMediaType(video.videoWidth > 0 || video.videoHeight > 0 ? 'video' : 'audio')
    }

    video.onerror = () => {
      setMediaType(null)
    }

    return () => {
      video.src = ''
    }
  }, [src])

  if (!mediaType) {
    return null
  }

  if (mediaType === 'video') {
    return <VideoPlayer src={src} className={className} />
  }

  return <AudioPlayer src={src} className={className} />
}

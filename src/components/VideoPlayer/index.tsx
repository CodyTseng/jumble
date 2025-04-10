import { cn } from '@/lib/utils'
import NsfwOverlay from '../NsfwOverlay'
import { useEffect, useRef, useState } from 'react'
import VideoManager from '@/services/videomanager'

export default function VideoPlayer({
  src,
  className,
  isNsfw = false,
  size = 'normal'
}: {
  src: string
  className?: string
  isNsfw?: boolean
  size?: 'normal' | 'small'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [isInPiP, setIsInPiP] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let observer: IntersectionObserver
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

    const handlePlay = async () => {
      setHasPlayed(true)
      await VideoManager.setCurrent(video)
    }

    const handleLeavePiP = () => {
      setIsInPiP(false)
      VideoManager.setPiPCallback(null)
    }

    const requestPiP = async () => {
      await VideoManager.setCurrent(video)

      if (isSafari && (video as any).webkitSupportsPresentationMode) {
        ;(video as any).webkitSetPresentationMode('picture-in-picture')
        setIsInPiP(true)
      } else if (
        document.pictureInPictureEnabled &&
        !video.disablePictureInPicture &&
        document.pictureInPictureElement !== video
      ) {
        try {
          await video.requestPictureInPicture()
          setIsInPiP(true)
        } catch (err) {
          console.error('Failed to enter PiP:', err)
        }
      }

      VideoManager.setPiPCallback(() => {
        setIsInPiP(false)
      })
    }

    const exitPiP = async () => {
      try {
        await VideoManager.clearPiP()
        setIsInPiP(false)
        video.pause()
      } catch (err) {
        console.error('Failed to exit PiP:', err)
      }
    }

    const handleIntersection = ([entry]: IntersectionObserverEntry[]) => {
      const isVisible = entry.isIntersecting

      if (hasPlayed && !isVisible && !isInPiP && !video.paused) {
        requestPiP()
      }

      if (isVisible && isInPiP) {
        exitPiP()
      }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('leavepictureinpicture', handleLeavePiP)
    video.addEventListener('webkitpresentationmodechanged', handleLeavePiP)

    observer = new IntersectionObserver(handleIntersection, { threshold: 0.5 })
    observer.observe(video)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('leavepictureinpicture', handleLeavePiP)
      video.removeEventListener('webkitpresentationmodechanged', handleLeavePiP)
      observer.disconnect()
      VideoManager.clearCurrent(video)
    }
  }, [hasPlayed, isInPiP])

  return (
    <>
      <div className="relative">
        <video
          ref={videoRef}
          controls
          className={cn('rounded-lg', size === 'small' ? 'h-[15vh]' : 'h-[30vh]', className)}
          src={src}
          onClick={(e) => e.stopPropagation()}
        />
        {isNsfw && <NsfwOverlay className="rounded-lg" />}
      </div>
    </>
  )
}

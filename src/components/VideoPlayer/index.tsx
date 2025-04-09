import { cn } from '@/lib/utils'
import NsfwOverlay from '../NsfwOverlay'
import { useEffect, useRef, useState } from 'react'

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

useEffect(() => {
  const videoEl = videoRef.current
  if (!videoEl) return

  // Flag to determine if user has played the video and wants PiP
  let wantsPiP = false

  // Will hold our observer instance so we can disconnect later
  let observer: IntersectionObserver | null = null

  // When video is played manually by the user
  const handlePlay = () => {
    setHasPlayed(true)
    wantsPiP = true 
  }

  // When user exits native PiP manually
  const handleLeavePiP = () => {
    wantsPiP = false // Prevent re-entering PiP immediately
  }

  // Add listeners to track user interaction and PiP exit
  videoEl.addEventListener('play', handlePlay)
  videoEl.addEventListener('leavepictureinpicture', handleLeavePiP)

  // Observe whether the video is in view or not
  observer = new IntersectionObserver(
    async ([entry]) => {
      if (!videoEl) return

      const isVisible = entry.isIntersecting

      // If video has been played, is out of view, and PiP is allowed
      if (
        !isVisible &&
        hasPlayed &&
        wantsPiP &&
        document.pictureInPictureEnabled &&
        !videoEl.disablePictureInPicture
      ) {
        try {
          // Enter PiP if not already in PiP
          if (document.pictureInPictureElement !== videoEl) {
            await videoEl.requestPictureInPicture()
          }
        } catch (err) {
          console.error('Failed to enter PiP:', err)
        }
      }

      // Exit PiP if video comes back into view and it's currently in PiP
      if (isVisible && document.pictureInPictureElement === videoEl) {
        try {
          await document.exitPictureInPicture()
        } catch (err) {
          console.error('Failed to exit PiP:', err)
        }
      }
    },
    { threshold: 0.5 } // Trigger callback when 50% of video is visible/invisible
  )

  // Start observing the video element
  observer.observe(videoEl)

  // Cleanup on component unmount
  return () => {
    videoEl.removeEventListener('play', handlePlay)
    videoEl.removeEventListener('leavepictureinpicture', handleLeavePiP)
    observer?.disconnect()
  }
}, [hasPlayed])

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

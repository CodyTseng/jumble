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
 const [isInPiP, setIsInPiP] = useState(false)

 useEffect(() => {
   const video = videoRef.current
   if (!video) return

   let observer: IntersectionObserver

   // Detect Safari using user agent (not perfect but good enough)
   const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

   // Called when video is played (by user)
   const handlePlay = () => {
     setHasPlayed(true)
   }

   // Called when PiP is exited (manually or automatically)
   const handleLeavePiP = () => {
     setIsInPiP(false)
   }

   // Request PiP mode, native for Chrome and webkit for Safari
   const requestPiP = async () => {
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
   }

   // Exit PiP and pause to allow re-entry later
   const exitPiP = async () => {
     if (isSafari && (video as any).webkitPresentationMode === 'picture-in-picture') {
       ;(video as any).webkitSetPresentationMode('inline')
       setIsInPiP(false)
       video.pause()
     } else if (document.pictureInPictureElement === video) {
       try {
         await document.exitPictureInPicture()
         setIsInPiP(false)
         video.pause()
       } catch (err) {
         console.error('Failed to exit PiP:', err)
       }
     }
   }

   // Main visibility observer
   const handleIntersection = ([entry]: IntersectionObserverEntry[]) => {
     const isVisible = entry.isIntersecting

     // If user has played, video is out of view and not already in PiP
     if (hasPlayed && !isVisible && !isInPiP && !video.paused) {
       requestPiP()
     }

     // If video is back in view and in PiP mode, exit PiP
     if (isVisible && isInPiP) {
       exitPiP()
     }
   }

   // Listen to native events
   video.addEventListener('play', handlePlay)
   video.addEventListener('leavepictureinpicture', handleLeavePiP)
   video.addEventListener('webkitpresentationmodechanged', handleLeavePiP)

   // Setup observer
   observer = new IntersectionObserver(handleIntersection, { threshold: 0.5 })
   observer.observe(video)

   return () => {
     video.removeEventListener('play', handlePlay)
     video.removeEventListener('leavepictureinpicture', handleLeavePiP)
     video.removeEventListener('webkitpresentationmodechanged', handleLeavePiP)
     observer.disconnect()
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

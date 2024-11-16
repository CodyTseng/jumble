import { ScrollArea, ScrollBar } from '@renderer/components/ui/scroll-area'
import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import NsfwOverlay from '../NsfwOverlay'

export default function ImageGallery({
  className,
  images,
  isNsfw = false,
  size = 'normal'
}: {
  className?: string
  images: string[]
  isNsfw?: boolean
  size?: 'normal' | 'small'
}) {
  const [index, setIndex] = useState(-1)

  const handlePhotoClick = (event: React.MouseEvent, current: number) => {
    event.preventDefault()
    setIndex(current)
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <ScrollArea className="w-full">
        <div className="flex space-x-2">
          {images.map((src, index) => {
            return (
              <img
                className={`rounded-lg object-cover h-fit cursor-pointer ${size === 'small' ? 'max-h-[15vh]' : 'max-h-[30vh]'}`}
                key={index}
                src={src}
                onClick={(e) => handlePhotoClick(e, index)}
              />
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <Lightbox
        index={index}
        slides={images.map((src) => ({ src }))}
        plugins={[Zoom]}
        open={index >= 0}
        close={() => setIndex(-1)}
        controller={{ closeOnBackdropClick: true, closeOnPullUp: true, closeOnPullDown: true }}
        styles={{ toolbar: { paddingTop: '2.25rem' } }}
      />
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </div>
  )
}

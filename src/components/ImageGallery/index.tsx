import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ReactNode, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'
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
  const { isSmallScreen } = useScreenSize()
  const [index, setIndex] = useState(-1)

  const handlePhotoClick = (event: React.MouseEvent, current: number) => {
    event.stopPropagation()
    event.preventDefault()
    setIndex(current)
  }

  let imageContent: ReactNode | null = null
  if (images.length === 1) {
    imageContent = (
      <Image
        key={index}
        className={cn('rounded-lg cursor-pointer', size === 'small' ? 'h-[15vh]' : 'h-[30vh]')}
        src={images[0]}
        onClick={(e) => handlePhotoClick(e, 0)}
      />
    )
  } else if (size === 'small') {
    imageContent = (
      <div className="grid grid-cols-4 gap-2">
        {images.map((src, i) => (
          <Image
            key={i}
            className="rounded-lg cursor-pointer aspect-square"
            src={src}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else if (isSmallScreen && (images.length === 2 || images.length === 4)) {
    imageContent = (
      <div className="grid grid-cols-2 gap-2">
        {images.map((src, i) => (
          <Image
            key={i}
            className="rounded-lg cursor-pointer aspect-square"
            src={src}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else {
    imageContent = (
      <div className="grid grid-cols-3 gap-2">
        {images.map((src, i) => (
          <Image
            key={i}
            className="rounded-lg cursor-pointer aspect-square"
            src={src}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('relative w-fit max-w-full', className)}>
      {imageContent}
      <div onClick={(e) => e.stopPropagation()}>
        <Lightbox
          index={index}
          slides={images.map((src) => ({ src }))}
          plugins={[Zoom]}
          open={index >= 0}
          close={() => setIndex(-1)}
          controller={{
            closeOnBackdropClick: true,
            closeOnPullUp: true,
            closeOnPullDown: true
          }}
          styles={{ toolbar: { paddingTop: '2.25rem' } }}
        />
      </div>
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </div>
  )
}

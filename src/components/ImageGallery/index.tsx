import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TImageInfo } from '@/types'
import { ReactNode, useState } from 'react'
import { createPortal } from 'react-dom'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'
import NsfwOverlay from '../NsfwOverlay'

export default function ImageGallery({
  className,
  images,
  isNsfw = false,
  size = 'normal',
  disableLightbox = false
}: {
  className?: string
  images: TImageInfo[]
  isNsfw?: boolean
  size?: 'normal' | 'small'
  disableLightbox?: boolean
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
        key={0}
        className={cn(
          'rounded-lg',
          !disableLightbox ? 'cursor-auto' : '',
          size === 'small' ? 'h-[15vh]' : 'h-[30vh]'
        )}
        image={images[0]}
        onClick={(e) => handlePhotoClick(e, 0)}
      />
    )
  } else if (size === 'small') {
    imageContent = (
      <div className="grid grid-cols-4 gap-2">
        {images.map((image, i) => (
          <Image
            key={i}
            className={cn('rounded-lg aspect-square w-full', !disableLightbox ? 'cursor-auto' : '')}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else if (isSmallScreen && (images.length === 2 || images.length === 4)) {
    imageContent = (
      <div className="grid grid-cols-2 gap-2">
        {images.map((image, i) => (
          <Image
            key={i}
            className={cn('rounded-lg aspect-square w-full', !disableLightbox ? 'cursor-auto' : '')}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else {
    imageContent = (
      <div className="grid grid-cols-3 gap-2">
        {images.map((image, i) => (
          <Image
            key={i}
            className={cn('rounded-lg aspect-square w-full', !disableLightbox ? 'cursor-auto' : '')}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('relative w-fit max-w-full', className)}>
      {imageContent}
      {index >= 0 &&
        !disableLightbox &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              index={index}
              slides={images.map(({ url }) => ({ src: url }))}
              plugins={[Zoom]}
              open={index >= 0}
              close={() => setIndex(-1)}
              controller={{
                closeOnBackdropClick: true,
                closeOnPullUp: true,
                closeOnPullDown: true
              }}
              styles={{
                toolbar: { paddingTop: '2.25rem' }
              }}
            />
          </div>,
          document.body
        )}
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </div>
  )
}

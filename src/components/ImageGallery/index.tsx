import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import modalManager from '@/services/modal-manager.service'
import { TImageInfo } from '@/types'
import { ReactNode, useEffect, useMemo, useState } from 'react'
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
  start = 0,
  end = images.length
}: {
  className?: string
  images: TImageInfo[]
  isNsfw?: boolean
  size?: 'normal' | 'small'
  start?: number
  end?: number
}) {
  const id = useMemo(() => `image-gallery-${randomString()}`, [])
  const { isSmallScreen } = useScreenSize()
  const [index, setIndex] = useState(-1)
  useEffect(() => {
    if (index >= 0) {
      modalManager.register(id, () => {
        setIndex(-1)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [index])

  const handlePhotoClick = (event: React.MouseEvent, current: number) => {
    event.stopPropagation()
    event.preventDefault()
    setIndex(start + current)
  }

  const displayImages = images.slice(start, end)
  let imageContent: ReactNode | null = null
  if (displayImages.length === 1) {
    imageContent = (
      <Image
        key={0}
        className={cn('rounded-lg', size === 'small' ? 'max-h-[15vh]' : 'max-h-[30vh]')}
        classNames={{
          errorPlaceholder: cn('aspect-square', size === 'small' ? 'h-[15vh]' : 'h-[30vh]')
        }}
        image={displayImages[0]}
        onClick={(e) => handlePhotoClick(e, 0)}
      />
    )
  } else if (size === 'small') {
    imageContent = (
      <div className="grid grid-cols-4 gap-2">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className={cn('aspect-square w-full rounded-lg')}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else if (isSmallScreen && (displayImages.length === 2 || displayImages.length === 4)) {
    imageContent = (
      <div className="grid grid-cols-2 gap-2">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className={cn('aspect-square w-full rounded-lg')}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else {
    imageContent = (
      <div className="grid grid-cols-3 gap-2 w-full">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className={cn('aspect-square w-full rounded-lg')}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative',
        displayImages.length === 1 ? 'w-fit max-w-full' : 'w-full',
        className
      )}
    >
      {imageContent}
      {index >= 0 &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              index={start + index}
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

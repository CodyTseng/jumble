import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
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
  start = 0,
  end = images.length
}: {
  className?: string
  images: TImageInfo[]
  isNsfw?: boolean
  start?: number
  end?: number
}) {
  const id = useMemo(() => `image-gallery-${randomString()}`, [])
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
        className="rounded-lg max-h-[80vh] sm:max-h-[50vh] border"
        classNames={{
          errorPlaceholder: 'aspect-square h-[30vh]'
        }}
        image={displayImages[0]}
        onClick={(e) => handlePhotoClick(e, 0)}
      />
    )
  } else if (displayImages.length === 2 || displayImages.length === 4) {
    imageContent = (
      <div className="grid grid-cols-2 gap-2 w-full">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className="aspect-square w-full rounded-lg border"
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
            className="aspect-square w-full rounded-lg border"
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

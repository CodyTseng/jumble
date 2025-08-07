import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import modalManager from '@/services/modal-manager.service'
import { TImageInfo } from '@/types'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'

export default function ImageWithLightbox({
  image,
  className
}: {
  image: TImageInfo
  className?: string
}) {
  const id = useMemo(() => `image-with-lightbox-${randomString()}`, [])
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

  const handlePhotoClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    setIndex(0)
  }

  return (
    <div className="w-fit max-w-full">
      <Image
        key={0}
        className={cn('rounded-lg max-h-[80vh] sm:max-h-[50vh] border cursor-zoom-in', className)}
        classNames={{
          errorPlaceholder: 'aspect-square h-[30vh]'
        }}
        image={image}
        onClick={(e) => handlePhotoClick(e)}
      />
      {index >= 0 &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              index={index}
              slides={[{ src: image.url }]}
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
    </div>
  )
}

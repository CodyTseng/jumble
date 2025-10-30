import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import blossomService from '@/services/blossom.service'
import modalManager from '@/services/modal-manager.service'
import { TImetaInfo } from '@/types'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'
import ImageWithLightbox from '../ImageWithLightbox'

export default function ImageGallery({
  className,
  images,
  start = 0,
  end = images.length,
  mustLoad = false
}: {
  className?: string
  images: TImetaInfo[]
  start?: number
  end?: number
  mustLoad?: boolean
}) {
  const id = useMemo(() => `image-gallery-${randomString()}`, [])
  const { autoLoadMedia } = useContentPolicy()
  const [index, setIndex] = useState(-1)
  const [slides, setSlides] = useState<{ src: string }[]>(images.map(({ url }) => ({ src: url })))
  useEffect(() => {
    if (index >= 0) {
      modalManager.register(id, () => {
        setIndex(-1)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [index])

  useEffect(() => {
    const loadImages = async () => {
      const slides = await Promise.all(
        images.map(({ url, pubkey }) => {
          return new Promise<{ src: string }>((resolve) => {
            const img = new window.Image()
            let validUrl = url
            img.onload = () => {
              blossomService.markAsSuccess(url, validUrl)
              resolve({ src: validUrl })
            }
            img.onerror = () => {
              blossomService.tryNextUrl(url).then((nextUrl) => {
                if (nextUrl) {
                  validUrl = nextUrl
                  resolve({ src: validUrl })
                } else {
                  resolve({ src: url })
                }
              })
            }
            if (pubkey) {
              blossomService
                .getValidUrl(url, pubkey)
                .then((u) => {
                  validUrl = u
                  img.src = validUrl
                })
                .catch(() => {
                  resolve({ src: url })
                })
            } else {
              img.src = url
            }
          })
        })
      )
      setSlides(slides)
    }

    loadImages()
  }, [images])

  const handlePhotoClick = (event: React.MouseEvent, current: number) => {
    event.stopPropagation()
    event.preventDefault()
    setIndex(start + current)
  }

  const displayImages = images.slice(start, end)

  if (!mustLoad && !autoLoadMedia) {
    return displayImages.map((image, i) => (
      <ImageWithLightbox
        key={i}
        image={image}
        className="max-h-[80vh] sm:max-h-[50vh] object-contain"
        classNames={{
          wrapper: cn('w-fit max-w-full', className)
        }}
      />
    ))
  }

  let imageContent: ReactNode | null = null
  if (displayImages.length === 1) {
    imageContent = (
      <Image
        key={0}
        className="max-h-[80vh] sm:max-h-[50vh] object-contain"
        classNames={{
          errorPlaceholder: 'aspect-square h-[30vh]',
          wrapper: 'cursor-zoom-in'
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
            className="aspect-square w-full"
            classNames={{ wrapper: 'cursor-zoom-in' }}
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
            className="aspect-square w-full"
            classNames={{ wrapper: 'cursor-zoom-in' }}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn(displayImages.length === 1 ? 'w-fit max-w-full' : 'w-full', className)}>
      {imageContent}
      {index >= 0 &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              index={index}
              slides={slides}
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

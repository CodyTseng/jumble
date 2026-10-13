import { useImageSave } from '@/hooks/useImageSave'
import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import blossomService from '@/services/blossom.service'
import modalManager from '@/services/modal-manager.service'
import { TImetaInfo } from '@/types'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { SlideImage } from 'yet-another-react-lightbox'
import Download from 'yet-another-react-lightbox/plugins/download'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'
import ImageWithLightbox from '../ImageWithLightbox'
import Lightbox from '../Lightbox'

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
  const { t } = useTranslation()
  const { autoLoadMedia } = useContentPolicy()
  const [index, setIndex] = useState(-1)
  const [slides, setSlides] = useState<SlideImage[]>(
    images.map(({ url, dim }) => ({ src: url, ...dim }))
  )
  const saveLightboxImage = useImageSave(slides[index]?.src, index >= 0)
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
        images.map(({ url, pubkey, dim }) => {
          return new Promise<SlideImage>((resolve) => {
            const img = new window.Image()
            let validUrl = url
            img.onload = () => {
              blossomService.markAsSuccess(url, validUrl)
              resolve({
                src: validUrl,
                width: dim?.width ?? img.naturalWidth,
                height: dim?.height ?? img.naturalHeight
              })
            }
            img.onerror = () => {
              blossomService.tryNextUrl(url).then((nextUrl) => {
                if (nextUrl) {
                  validUrl = nextUrl
                  resolve({ src: validUrl, ...dim })
                } else {
                  resolve({ src: url, ...dim })
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
                  resolve({ src: url, ...dim })
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
        upscaleSmall
        key={i}
        image={image}
        className="max-h-[80vh] object-contain sm:max-h-[50vh]"
        classNames={{
          wrapper: cn('w-fit max-w-full border', className)
        }}
      />
    ))
  }

  let imageContent: ReactNode | null = null
  if (displayImages.length === 1) {
    imageContent = (
      <Image
        key={0}
        className="max-h-[80vh] object-contain sm:max-h-[50vh]"
        classNames={{
          errorPlaceholder: 'aspect-square h-[30vh]',
          wrapper: 'w-fit max-w-full cursor-zoom-in border'
        }}
        image={displayImages[0]}
        upscaleSmall
        onClick={(e) => handlePhotoClick(e, 0)}
      />
    )
  } else if (displayImages.length === 2 || displayImages.length === 4) {
    imageContent = (
      <div className="grid w-full grid-cols-2 gap-2">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            classNames={{ wrapper: 'aspect-square w-full cursor-zoom-in border' }}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else {
    imageContent = (
      <div className="grid w-full grid-cols-3 gap-2">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            classNames={{ wrapper: 'aspect-square w-full cursor-zoom-in border' }}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      {imageContent}
      {index >= 0 &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              upscaleSmall
              index={index}
              slides={slides}
              plugins={[Download, Zoom]}
              labels={{ Download: t('Save') }}
              download={{
                download: ({ saveAs }) => saveLightboxImage(saveAs)
              }}
              on={{ view: ({ index }) => setIndex(index) }}
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

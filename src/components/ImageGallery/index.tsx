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
import Lightbox from '../Lightbox'
import ImageStrip from './ImageStrip'

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
  const [revealed, setRevealed] = useState(false)
  const shouldLoad = mustLoad || autoLoadMedia || revealed
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
    if (!shouldLoad) return
    let cancelled = false
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
      if (!cancelled) setSlides(slides)
    }

    loadImages()
    return () => {
      cancelled = true
    }
  }, [images, shouldLoad])

  const handlePhotoClick = (event: React.MouseEvent, current: number) => {
    event.preventDefault()
    setIndex(start + current)
  }

  const displayImages = images.slice(start, end)

  if (!shouldLoad) {
    return (
      <button
        type="button"
        className={cn('text-primary w-fit cursor-pointer truncate hover:underline', className)}
        onClick={() => setRevealed(true)}
      >
        [{t('Click to load image')}]
      </button>
    )
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
        fillNearRow
        role="button"
        tabIndex={0}
        aria-label={t('Open image')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.currentTarget.click()
          }
        }}
        onClick={(e) => handlePhotoClick(e, 0)}
      />
    )
  } else if (displayImages.length > 1) {
    imageContent = <ImageStrip images={displayImages} onPhotoClick={handlePhotoClick} />
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

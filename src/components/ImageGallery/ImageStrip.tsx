import { TImetaInfo } from '@/types'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from '../Image'
import { ImageSize, isValidImageSize } from '../Image/display-size'
import { getVisibleImageIndexes } from './pagination'

const arrowClass =
  'absolute top-[calc(var(--gallery-height)/2)] z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow transition-opacity hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/image-strip:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100'

export default function ImageStrip({
  images,
  onPhotoClick
}: {
  images: TImetaInfo[]
  onPhotoClick: (event: React.MouseEvent, index: number) => void
}) {
  const { t, i18n } = useTranslation()
  const direction = i18n.dir()
  const wheelPlugins = useMemo(() => [WheelGesturesPlugin()], [])
  const viewportElement = useRef<HTMLDivElement | null>(null)
  const alignToInset = useCallback(() => {
    const firstSlide = viewportElement.current?.firstElementChild?.firstElementChild
    return firstSlide ? parseFloat(window.getComputedStyle(firstSlide).marginInlineStart) || 0 : 0
  }, [])
  const [viewportRef, api] = useEmblaCarousel(
    // Keep one snap per image so dot indexes stay correct even when several
    // trailing images share the same right-aligned scroll position.
    { align: alignToInset, containScroll: 'keepSnaps', direction, skipSnaps: true },
    wheelPlugins
  )
  const setViewportRef = useCallback(
    (element: HTMLDivElement | null) => {
      viewportElement.current = element
      viewportRef(element)
    },
    [viewportRef]
  )
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [currentImage, setCurrentImage] = useState(0)
  const [naturalSizes, setNaturalSizes] = useState<Record<string, ImageSize>>({})
  const updateNavigation = useCallback(() => {
    setCanScrollPrev(api?.canScrollPrev() ?? false)
    setCanScrollNext(api?.canScrollNext() ?? false)
    setCurrentImage(api?.selectedScrollSnap() ?? 0)
  }, [api])

  useEffect(() => {
    if (!api) return
    updateNavigation()
    api.on('select', updateNavigation)
    api.on('reInit', updateNavigation)
    return () => {
      api.off('select', updateNavigation)
      api.off('reInit', updateNavigation)
    }
  }, [api, updateNavigation])

  return (
    <div
      dir={direction}
      className="group/image-strip relative w-full min-w-0 [--gallery-height:min(350px,50vh)]"
      style={{
        width: 'calc(100% + var(--image-strip-bleed, 0px) * 2)',
        marginInline: 'calc(0px - var(--image-strip-bleed, 0px))'
      }}
      role="region"
      aria-label={t('Pictures')}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const next = (event.key === 'ArrowRight') === (direction === 'ltr')
        if (next) api?.scrollNext()
        else api?.scrollPrev()
      }}
    >
      <div ref={setViewportRef} className="overflow-hidden">
        <div className="flex touch-pan-y gap-2">
          {images.map((image, index) => {
            const size = isValidImageSize(image.dim) ? image.dim : naturalSizes[image.url]
            const ratio = size ? Math.min(1.25, Math.max(0.65, size.width / size.height)) : 1.2
            return (
              <button
                type="button"
                key={`${image.url}-${index}`}
                className="focus-visible:outline-primary h-[var(--gallery-height)] min-w-0 shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  width: `min(85%, calc(var(--gallery-height) * ${ratio}))`,
                  marginInlineStart: index === 0 ? 'var(--image-strip-bleed, 0px)' : undefined,
                  marginInlineEnd:
                    index === images.length - 1 ? 'var(--image-strip-bleed, 0px)' : undefined
                }}
                aria-label={t('Open image')}
                onClick={(event) => onPhotoClick(event, index)}
              >
                <Image
                  image={image}
                  classNames={{ wrapper: 'h-full w-full cursor-zoom-in border' }}
                  onImageLoad={(_url, img) => {
                    const size = { width: img.naturalWidth, height: img.naturalHeight }
                    if (!isValidImageSize(size)) return
                    setNaturalSizes((previous) => {
                      const old = previous[image.url]
                      return old?.width === size.width && old.height === size.height
                        ? previous
                        : { ...previous, [image.url]: size }
                    })
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>
      {canScrollPrev && (
        <button
          type="button"
          className={`${arrowClass} start-3`}
          aria-label={t('Previous image')}
          onClick={() => api?.scrollPrev()}
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
        </button>
      )}
      {canScrollNext && (
        <button
          type="button"
          className={`${arrowClass} end-3`}
          aria-label={t('Next image')}
          onClick={() => api?.scrollNext()}
        >
          <ArrowRight className="size-4 rtl:-scale-x-100" />
        </button>
      )}
      {(canScrollPrev || canScrollNext) && (
        <div className="flex items-center justify-center pt-1" aria-label={t('Pictures')}>
          {getVisibleImageIndexes(images.length, currentImage).map((index) => {
            const active = index === currentImage
            return (
              <button
                key={index}
                type="button"
                className="focus-visible:outline-primary flex h-6 w-4 items-center justify-center rounded-full focus-visible:outline-2"
                aria-label={t('Go to image {{number}} of {{total}}', {
                  number: index + 1,
                  total: images.length
                })}
                aria-current={active ? 'true' : undefined}
                onClick={() => api?.scrollTo(index)}
              >
                <span
                  className={`rounded-full transition-colors ${active ? 'bg-foreground size-2' : 'bg-muted-foreground/40 size-1.5'}`}
                />
              </button>
            )
          })}
          {images.length > 9 && (
            <span dir="ltr" className="text-muted-foreground ms-2 text-xs tabular-nums">
              {currentImage + 1} / {images.length}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

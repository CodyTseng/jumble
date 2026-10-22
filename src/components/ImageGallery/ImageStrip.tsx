import { TImetaInfo } from '@/types'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ClickableCard from '../ClickableCard'
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
  const viewportElement = useRef<HTMLDivElement | null>(null)
  const scrollPositions = useRef<number[]>([])
  const selectedImage = useRef(0)
  const scrollTargetImage = useRef<number | null>(null)
  const mouseDrag = useRef<{
    x: number
    scrollLeft: number
    moved: boolean
    target: HTMLElement
  } | null>(null)
  const suppressClick = useRef(false)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [currentImage, setCurrentImage] = useState(0)
  const [naturalSizes, setNaturalSizes] = useState<Record<string, ImageSize>>({})
  const updateNavigation = useCallback(() => {
    const viewport = viewportElement.current
    if (!viewport) return
    const position = viewport.scrollLeft * (direction === 'rtl' ? -1 : 1)
    const max = viewport.scrollWidth - viewport.clientWidth
    setCanScrollPrev(position > 1)
    setCanScrollNext(position < max - 1)
    const targetImage = scrollTargetImage.current
    if (targetImage !== null) {
      const target = scrollPositions.current[targetImage]
      if (target !== undefined) {
        setCurrentImage(targetImage)
        if (Math.abs(target - position) <= 1) scrollTargetImage.current = null
        return
      }
      scrollTargetImage.current = null
    }
    // Retain the selected dot when several trailing images have the same target.
    let closest = Math.min(selectedImage.current, scrollPositions.current.length - 1)
    scrollPositions.current.forEach((target, index) => {
      if (Math.abs(target - position) < Math.abs(scrollPositions.current[closest] - position) - 1) {
        closest = index
      }
    })
    setCurrentImage(Math.max(0, closest))
  }, [direction])

  useEffect(() => {
    const viewport = viewportElement.current
    const track = viewport?.firstElementChild
    if (!viewport || !track) return
    const measure = () => {
      const slides = Array.from(track.children)
      const inset = slides[0]
        ? parseFloat(window.getComputedStyle(slides[0]).marginInlineStart) || 0
        : 0
      const bounds = viewport.getBoundingClientRect()
      const sign = direction === 'rtl' ? -1 : 1
      const position = viewport.scrollLeft * sign
      const max = viewport.scrollWidth - viewport.clientWidth
      scrollPositions.current = slides.map((slide) => {
        const rect = slide.getBoundingClientRect()
        const offset = direction === 'rtl' ? bounds.right - rect.right : rect.left - bounds.left
        return Math.max(0, Math.min(max, position + offset - inset))
      })
      updateNavigation()
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    Array.from(track.children).forEach((slide) => observer.observe(slide))
    // Only the indicators run on the main thread; gestures scroll natively.
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        updateNavigation()
      })
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    const onWheel = () => {
      scrollTargetImage.current = null
    }
    const onScrollEnd = () => {
      scrollTargetImage.current = null
      updateNavigation()
    }
    viewport.addEventListener('wheel', onWheel, { passive: true })
    viewport.addEventListener('scrollend', onScrollEnd)
    measure()
    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', onScroll)
      viewport.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('scrollend', onScrollEnd)
      cancelAnimationFrame(frame)
    }
  }, [direction, images, updateNavigation])

  const scrollToImage = (index: number) => {
    const viewport = viewportElement.current
    const position = scrollPositions.current[index]
    if (!viewport || position === undefined) return
    selectedImage.current = index
    scrollTargetImage.current = index
    setCurrentImage(index)
    viewport.scrollTo({
      left: position * (direction === 'rtl' ? -1 : 1),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    })
  }

  const scrollByImage = (next: boolean) => {
    const viewport = viewportElement.current
    if (!viewport) return
    const position = viewport.scrollLeft * (direction === 'rtl' ? -1 : 1)
    const targets = scrollPositions.current
    const index = next
      ? targets.findIndex((target) => target > position + 1)
      : targets.reduce((previous, target, index) => (target < position - 1 ? index : previous), -1)
    if (index >= 0) scrollToImage(index)
  }

  return (
    <div
      dir={direction}
      className="group/image-strip relative z-10 w-full min-w-0 [--gallery-height:min(350px,50vh)]"
      style={{
        width:
          'calc(100% + var(--image-strip-bleed-start, var(--image-strip-bleed, 0px)) + var(--image-strip-bleed, 0px))',
        marginInlineStart:
          'calc(0px - var(--image-strip-bleed-start, var(--image-strip-bleed, 0px)))',
        marginInlineEnd: 'calc(0px - var(--image-strip-bleed, 0px))'
      }}
      role="region"
      aria-label={t('Pictures')}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const next = (event.key === 'ArrowRight') === (direction === 'ltr')
        scrollByImage(next)
      }}
    >
      <ClickableCard
        ref={viewportElement}
        className="scrollbar-hide cursor-default overflow-x-auto overscroll-x-contain"
        onPointerDown={(event) => {
          scrollTargetImage.current = null
          suppressClick.current = false
          if (event.pointerType !== 'mouse' || event.button !== 0) return
          const target = event.target instanceof Element ? event.target.closest('button') : null
          mouseDrag.current = {
            x: event.clientX,
            scrollLeft: event.currentTarget.scrollLeft,
            moved: false,
            target: target && event.currentTarget.contains(target) ? target : event.currentTarget
          }
        }}
        onPointerMove={(event) => {
          const drag = mouseDrag.current
          if (!drag) return
          const distance = event.clientX - drag.x
          if (!drag.moved && Math.abs(distance) < 5) return
          // Capture on the image button, or the nested card boundary for gaps.
          if (!drag.moved) drag.target.setPointerCapture(event.pointerId)
          drag.moved = true
          suppressClick.current = true
          event.preventDefault()
          event.currentTarget.scrollLeft = drag.scrollLeft - distance
        }}
        onPointerUp={() => {
          mouseDrag.current = null
        }}
        onPointerCancel={() => {
          mouseDrag.current = null
        }}
        onPointerLeave={() => {
          if (!mouseDrag.current?.moved) mouseDrag.current = null
        }}
        onLostPointerCapture={() => {
          mouseDrag.current = null
        }}
      >
        <div className="flex gap-2 select-none">
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
                  marginInlineStart:
                    index === 0
                      ? 'var(--image-strip-bleed-start, var(--image-strip-bleed, 0px))'
                      : undefined,
                  marginInlineEnd:
                    index === images.length - 1 ? 'var(--image-strip-bleed, 0px)' : undefined
                }}
                aria-label={t('Open image')}
                onClick={(event) => {
                  if (suppressClick.current && event.detail !== 0) {
                    event.preventDefault()
                    return
                  }
                  onPhotoClick(event, index)
                }}
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
      </ClickableCard>
      {canScrollPrev && (
        <button
          type="button"
          className={`${arrowClass} start-3`}
          aria-label={t('Previous image')}
          onClick={() => scrollByImage(false)}
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
        </button>
      )}
      {canScrollNext && (
        <button
          type="button"
          className={`${arrowClass} end-3`}
          aria-label={t('Next image')}
          onClick={() => scrollByImage(true)}
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
                onClick={() => scrollToImage(index)}
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

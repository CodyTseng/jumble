import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactLightbox, {
  ImageSlide,
  isImageSlide,
  useLightboxProps,
  useLightboxState,
  type LightboxExternalProps,
  type RenderSlideProps,
  type SlideImage
} from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/plugins/zoom'
import ScrollLockPlugin from './scroll-lock'
import {
  getImageMaxZoom,
  getLightboxImageSize,
  isSmallLightboxImage,
  isValidImageSize,
  type ImageSize
} from '../Image/display-size'

type ContentImageSlide = Omit<SlideImage, 'type'> & { type: 'content-image' }

declare module 'yet-another-react-lightbox' {
  interface SlideTypes {
    'content-image': ContentImageSlide
  }
}

type Measurement = { natural: ImageSize; display: ImageSize }

// Custom slides let Zoom measure the displayed box rather than assume that
// an image can never be larger than its natural dimensions.
function ContentImage({
  slide,
  rect,
  offset,
  onMeasure
}: RenderSlideProps<ContentImageSlide> & {
  onMeasure: (src: string, measurement: Measurement) => void
}) {
  const { carousel, render, on } = useLightboxProps()
  const { currentIndex } = useLightboxState()
  const [loadedSize, setLoadedSize] = useState<(ImageSize & { src: string }) | null>(null)
  const metadata = { width: slide.width ?? 0, height: slide.height ?? 0 }
  const natural = isValidImageSize(metadata)
    ? metadata
    : loadedSize?.src === slide.src
      ? loadedSize
      : undefined
  const display = natural ? getLightboxImageSize(natural, rect) : undefined

  useEffect(() => {
    if (natural && display) onMeasure(slide.src, { natural, display })
  }, [slide.src, natural?.width, natural?.height, display?.width, display?.height, onMeasure])

  return (
    <ImageSlide
      slide={{ ...slide, type: 'image' }}
      rect={rect}
      offset={offset}
      render={render}
      imageFit={carousel.imageFit}
      imageProps={carousel.imageProps}
      onClick={offset === 0 ? () => on.click?.({ index: currentIndex }) : undefined}
      onLoad={(img) =>
        setLoadedSize({ src: slide.src, width: img.naturalWidth, height: img.naturalHeight })
      }
      style={
        natural && display && display.width > natural.width
          ? {
              width: display.width,
              height: display.height,
              maxWidth: '100%',
              maxHeight: '100%'
            }
          : undefined
      }
    />
  )
}

export default function Lightbox({
  upscaleSmall = false,
  slides,
  render,
  zoom,
  plugins = [],
  ...props
}: LightboxExternalProps & {
  upscaleSmall?: boolean
}) {
  const [measurements, setMeasurements] = useState<Record<string, Measurement>>({})
  const onMeasure = useCallback((src: string, measurement: Measurement) => {
    setMeasurements((previous) => {
      const old = previous[src]
      if (
        old &&
        old.natural.width === measurement.natural.width &&
        old.natural.height === measurement.natural.height &&
        old.display.width === measurement.display.width &&
        old.display.height === measurement.display.height
      )
        return previous
      return { ...previous, [src]: measurement }
    })
  }, [])
  const contentSlides = useMemo(
    () =>
      slides?.map((slide) => {
        if (!isImageSlide(slide)) return slide
        const metadata = { width: slide.width ?? 0, height: slide.height ?? 0 }
        const natural = isValidImageSize(metadata) ? metadata : measurements[slide.src]?.natural
        // Large images use the library's existing renderer and Zoom behavior.
        if (natural && !isSmallLightboxImage(natural)) return slide
        return { ...slide, type: 'content-image' as const, download: slide.download ?? slide.src }
      }),
    [slides, measurements]
  )

  const lightboxPlugins = [ScrollLockPlugin, ...plugins]

  if (!upscaleSmall)
    return (
      <ReactLightbox
        slides={slides}
        render={render}
        zoom={zoom}
        plugins={lightboxPlugins}
        {...props}
      />
    )

  return (
    <ReactLightbox
      {...props}
      plugins={lightboxPlugins}
      slides={contentSlides}
      render={{
        ...render,
        slide: (args) =>
          args.slide.type === 'content-image' ? (
            <ContentImage {...args} slide={args.slide} onMeasure={onMeasure} />
          ) : (
            render?.slide?.(args)
          )
      }}
      zoom={{
        ...zoom,
        supports: [...(zoom?.supports ?? []), 'content-image'],
        maxZoom: (slide) => {
          if (slide.type !== 'content-image')
            return typeof zoom?.maxZoom === 'function' ? zoom.maxZoom(slide) : zoom?.maxZoom
          const measurement = measurements[slide.src]
          return measurement
            ? getImageMaxZoom(measurement.natural, measurement.display, zoom?.maxZoomPixelRatio)
            : 1
        }
      }}
    />
  )
}

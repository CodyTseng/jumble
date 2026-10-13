import { Skeleton } from '@/components/ui/skeleton'
import { useBlossomUrl } from '@/hooks/useBlossomUrl'
import { cn } from '@/lib/utils'
import { TImetaInfo } from '@/types'
import { decode } from 'blurhash'
import { ImageOff } from 'lucide-react'
import { HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import { ImageSize, isSmallInlineImage, isValidImageSize, shouldFillImageRow } from './display-size'

export default function Image({
  image: { url, blurHash, thumbHash, pubkey, dim },
  alt,
  className = '',
  classNames = {},
  hideIfError = false,
  errorPlaceholder = <ImageOff />,
  onImageLoad,
  upscaleSmall = false,
  fillNearRow = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  classNames?: {
    wrapper?: string
    errorPlaceholder?: string
    skeleton?: string
  }
  image: TImetaInfo
  alt?: string
  hideIfError?: boolean
  errorPlaceholder?: React.ReactNode
  onImageLoad?: (url: string, img: HTMLImageElement) => void
  upscaleSmall?: boolean
  fillNearRow?: boolean
}) {
  const { url: imageUrl, error: hasError, handleError, markSuccess } = useBlossomUrl(url, pubkey)
  const [isLoaded, setIsLoaded] = useState(false)
  const [displaySkeleton, setDisplaySkeleton] = useState(true)
  const [loadedSize, setLoadedSize] = useState<(ImageSize & { url: string }) | null>(null)
  const size = isValidImageSize(dim) ? dim : loadedSize?.url === url ? loadedSize : undefined
  const small = upscaleSmall && isSmallInlineImage(size)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [rowWidth, setRowWidth] = useState(0)
  const fillRow = fillNearRow && shouldFillImageRow(size, rowWidth)
  const sizeDisplay = small || fillRow

  useEffect(() => {
    const parent = wrapperRef.current?.parentElement
    if (!fillNearRow || !parent) return
    const observer = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width))
    observer.observe(parent)
    return () => observer.disconnect()
  }, [fillNearRow])

  useEffect(() => {
    setIsLoaded(false)
    setDisplaySkeleton(true)
  }, [url])

  if (hideIfError && hasError) return null

  const isLoading = !isLoaded && !hasError

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget
    setLoadedSize({ url, width: img.naturalWidth, height: img.naturalHeight })
    setIsLoaded(true)
    setTimeout(() => setDisplaySkeleton(false), 600)
    markSuccess()
    if (imageUrl) onImageLoad?.(imageUrl, img)
  }

  return (
    <div
      {...props}
      ref={wrapperRef}
      className={cn(
        'relative overflow-hidden rounded-xl',
        classNames.wrapper,
        sizeDisplay && 'w-full max-w-full [--image-max-height:80vh] sm:[--image-max-height:50vh]',
        small && !fillRow && 'max-w-[480px]'
      )}
      style={
        sizeDisplay && size
          ? {
              ...props.style,
              width: `min(${fillRow ? '' : '480px, '}100%, calc(var(--image-max-height) * ${size.width / size.height}))`
            }
          : props.style
      }
    >
      {/* Spacer: transparent image to maintain dimensions when image is loading */}
      {isLoading && dim?.width && dim?.height && (
        <img
          src={`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${dim.width}' height='${dim.height}'%3E%3C/svg%3E`}
          className={cn(
            'pointer-events-none h-full w-full object-cover transition-opacity',
            className,
            sizeDisplay && 'h-auto'
          )}
          alt=""
        />
      )}
      {displaySkeleton && (
        <div className="absolute inset-0 z-10">
          {thumbHash ? (
            <ThumbHashPlaceholder
              thumbHash={thumbHash}
              className={cn(
                'h-full w-full transition-opacity',
                isLoading ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : blurHash ? (
            <BlurHashCanvas
              blurHash={blurHash}
              className={cn(
                'h-full w-full transition-opacity',
                isLoading ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : (
            <Skeleton
              className={cn(
                'h-full w-full transition-opacity',
                isLoading ? 'opacity-100' : 'opacity-0',
                classNames.skeleton
              )}
            />
          )}
        </div>
      )}
      {!hasError && (
        <img
          src={imageUrl}
          alt={alt}
          decoding="async"
          draggable={false}
          {...props}
          role={undefined}
          tabIndex={undefined}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'pointer-events-none h-full w-full object-cover transition-opacity',
            isLoading ? 'absolute inset-0 opacity-0' : '',
            className,
            sizeDisplay && 'h-auto'
          )}
        />
      )}
      {hasError &&
        (typeof errorPlaceholder === 'string' ? (
          <img
            src={errorPlaceholder}
            alt={alt}
            decoding="async"
            loading="lazy"
            className={cn('h-full w-full object-cover transition-opacity', className)}
          />
        ) : (
          <div
            className={cn(
              'bg-muted flex h-full w-full flex-col items-center justify-center object-cover',
              className,
              classNames.errorPlaceholder
            )}
          >
            {errorPlaceholder}
          </div>
        ))}
    </div>
  )
}

const blurHashWidth = 32
const blurHashHeight = 32
function BlurHashCanvas({ blurHash, className = '' }: { blurHash: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const pixels = useMemo(() => {
    if (!blurHash) return null
    try {
      return decode(blurHash, blurHashWidth, blurHashHeight)
    } catch (error) {
      console.warn('Failed to decode blurhash:', error)
      return null
    }
  }, [blurHash])

  useEffect(() => {
    if (!pixels || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.createImageData(blurHashWidth, blurHashHeight)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)
  }, [pixels])

  if (!blurHash) return null

  return (
    <canvas
      ref={canvasRef}
      width={blurHashWidth}
      height={blurHashHeight}
      className={cn('h-full w-full rounded-xl object-cover', className)}
      style={{
        imageRendering: 'auto',
        filter: 'blur(0.5px)'
      }}
    />
  )
}

function ThumbHashPlaceholder({
  thumbHash,
  className = ''
}: {
  thumbHash: Uint8Array
  className?: string
}) {
  const dataUrl = useMemo(() => {
    if (!thumbHash) return null
    try {
      return thumbHashToDataURL(thumbHash)
    } catch (error) {
      console.warn('failed to decode thumbhash:', error)
      return null
    }
  }, [thumbHash])

  if (!dataUrl) return null

  return (
    <div
      className={cn('h-full w-full rounded-lg object-cover', className)}
      style={{
        backgroundImage: `url(${dataUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(1px)'
      }}
    />
  )
}

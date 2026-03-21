import { Skeleton } from '@/components/ui/skeleton'
import { isInsecureUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import blossomService from '@/services/blossom.service'
import storage from '@/services/local-storage.service'
import { TImetaInfo } from '@/types'
import { decode } from 'blurhash'
import { ImageOff } from 'lucide-react'
import { HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import ExternalLink from '../ExternalLink'

export default function Image({
  image: { url, blurHash, thumbHash, pubkey, dim },
  alt,
  className = '',
  classNames = {},
  hideIfError = false,
  errorPlaceholder = <ImageOff />,
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
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [displaySkeleton, setDisplaySkeleton] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    setIsBlocked(false)
    setDisplaySkeleton(true)

    if (!storage.getAllowInsecureConnection() && isInsecureUrl(url)) {
      setIsBlocked(true)
      setIsLoading(false)
      return
    }

    if (pubkey) {
      blossomService.getValidUrl(url, pubkey).then((validUrl) => {
        setImageUrl(validUrl)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      })
      timeoutRef.current = setTimeout(() => {
        setImageUrl(url)
      }, 5000)
    } else {
      setImageUrl(url)
    }
  }, [url])

  if (isBlocked) {
    return <ExternalLink url={url} />
  }

  if (hideIfError && hasError) return null

  const handleError = async () => {
    const nextUrl = await blossomService.tryNextUrl(url)
    if (nextUrl) {
      setImageUrl(nextUrl)
    } else {
      setIsLoading(false)
      setHasError(true)
    }
  }

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
    setTimeout(() => setDisplaySkeleton(false), 600)
    blossomService.markAsSuccess(url, imageUrl || url)
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl', classNames.wrapper)} {...props}>
      {/* Spacer: transparent image to maintain dimensions when image is loading */}
      {isLoading && dim?.width && dim?.height && (
        <img
          src={`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${dim.width}' height='${dim.height}'%3E%3C/svg%3E`}
          className={cn(
            'pointer-events-none h-full w-full object-cover transition-opacity',
            className
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
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'pointer-events-none h-full w-full object-cover transition-opacity',
            isLoading ? 'absolute inset-0 opacity-0' : '',
            className
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
              'flex h-full w-full flex-col items-center justify-center bg-muted object-cover',
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

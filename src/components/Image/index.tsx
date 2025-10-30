import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import blossomService from '@/services/blossom.service'
import { TImetaInfo } from '@/types'
import { decode } from 'blurhash'
import { ImageOff } from 'lucide-react'
import { HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react'

export default function Image({
  image: { url, blurHash, pubkey, dim },
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
  }
  image: TImetaInfo
  alt?: string
  hideIfError?: boolean
  errorPlaceholder?: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [displaySkeleton, setDisplaySkeleton] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    setDisplaySkeleton(true)

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
    <div className={cn('relative overflow-hidden', classNames.wrapper)} {...props}>
      {displaySkeleton && (
        <div className="absolute inset-0 z-10">
          {blurHash ? (
            <BlurHashCanvas
              blurHash={blurHash}
              className={cn(
                'absolute inset-0 transition-opacity rounded-lg',
                isLoading ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : (
            <Skeleton
              className={cn(
                'absolute inset-0 transition-opacity rounded-lg',
                isLoading ? 'opacity-100' : 'opacity-0'
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
            'object-cover rounded-lg w-full h-full transition-opacity pointer-events-none',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          width={dim?.width}
          height={dim?.height}
        />
      )}
      {hasError &&
        (typeof errorPlaceholder === 'string' ? (
          <img
            src={errorPlaceholder}
            alt={alt}
            decoding="async"
            loading="lazy"
            className={cn('object-cover rounded-lg w-full h-full transition-opacity', className)}
          />
        ) : (
          <div
            className={cn(
              'object-cover flex flex-col items-center justify-center w-full h-full bg-muted',
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
      className={cn('w-full h-full object-cover rounded-lg', className)}
      style={{
        imageRendering: 'auto',
        filter: 'blur(0.5px)'
      }}
    />
  )
}

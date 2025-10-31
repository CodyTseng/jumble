import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import client from '@/services/client.service'
import { TImetaInfo } from '@/types'
import { getHashFromURL } from 'blossom-client-sdk'
import { decode } from 'blurhash'
import { ImageOff } from 'lucide-react'
import { HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react'

export default function Image({
  image: { url, blurHash, pubkey, dim, alt: imageAlt },
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
  const [imageUrl, setImageUrl] = useState(url)
  const [tried, setTried] = useState(new Set())

  useEffect(() => {
    setImageUrl(url)
    setIsLoading(true)
    setHasError(false)
    setDisplaySkeleton(true)
    setTried(new Set())
  }, [url])

  if (hideIfError && hasError) return null

  const handleError = async () => {
    // If it's a data URL, we can't recover from the error
    if (imageUrl.startsWith('data:')) {
      setIsLoading(false)
      setHasError(true)
      return
    }

    let oldImageUrl: URL | undefined
    let hash: string | null = null
    try {
      oldImageUrl = new URL(imageUrl)
      hash = getHashFromURL(oldImageUrl)
    } catch (error) {
      // Invalid URL, can't retry
    }
    if (!pubkey || !hash || !oldImageUrl) {
      setIsLoading(false)
      setHasError(true)
      return
    }

    const ext = oldImageUrl.pathname.match(/\.\w+$/i)
    setTried((prev) => new Set(prev.add(oldImageUrl.hostname)))

    const blossomServerList = await client.fetchBlossomServerList(pubkey)
    const urls = blossomServerList
      .map((server) => {
        try {
          return new URL(server)
        } catch (error) {
          console.error('Invalid Blossom server URL:', server, error)
          return undefined
        }
      })
      .filter((url) => !!url && !tried.has(url.hostname))
    const nextUrl = urls[0]
    if (!nextUrl) {
      setIsLoading(false)
      setHasError(true)
      return
    }

    nextUrl.pathname = '/' + hash + ext
    setImageUrl(nextUrl.toString())
  }

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
    setTimeout(() => setDisplaySkeleton(false), 600)
  }

  return (
    <div className={cn('relative overflow-hidden', classNames.wrapper)} {...props}>
      {displaySkeleton && (
        <div className="absolute inset-0 z-10">
          {blurHash ? (
            <BlurHashCanvas
              blurHash={blurHash}
              className={cn(
                'absolute inset-0 transition-opacity duration-500 rounded-lg',
                isLoading ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : (
            <Skeleton
              className={cn(
                'absolute inset-0 transition-opacity duration-500 rounded-lg',
                isLoading ? 'opacity-100' : 'opacity-0'
              )}
            />
          )}
        </div>
      )}
      {!hasError && (
        <img
          src={imageUrl}
          alt={alt || imageAlt || ''}
          decoding="async"
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'object-cover rounded-lg w-full h-full transition-opacity duration-500',
            className
          )}
          width={dim?.width}
          height={dim?.height}
          {...props}
        />
      )}
      {hasError && (
        <div
          className={cn(
            'object-cover flex flex-col items-center justify-center w-full h-full bg-muted',
            className,
            classNames.errorPlaceholder
          )}
        >
          {errorPlaceholder}
        </div>
      )}
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

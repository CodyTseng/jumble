import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import client from '@/services/client.service'
import { TImageInfo } from '@/types'
import { getHashFromURL } from 'blossom-client-sdk'
import { decode } from 'blurhash'
import { ImageOff } from 'lucide-react'
import { HTMLAttributes, useEffect, useState } from 'react'

export default function Image({
  image: { url, blurHash, pubkey },
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
  image: TImageInfo
  alt?: string
  hideIfError?: boolean
  errorPlaceholder?: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [displayBlurHash, setDisplayBlurHash] = useState(true)
  const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const [imageUrl, setImageUrl] = useState(url)
  const [triedUrls, setTriedUrls] = useState(new Set([url]))

  useEffect(() => {
    if (blurHash) {
      const { numX, numY } = decodeBlurHashSize(blurHash)
      const width = numX * 3
      const height = numY * 3
      const pixels = decode(blurHash, width, height)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const imageData = ctx.createImageData(width, height)
        imageData.data.set(pixels)
        ctx.putImageData(imageData, 0, 0)
        setBlurDataUrl(canvas.toDataURL())
      }
    }
  }, [blurHash])

  if (hideIfError && hasError) return null

  const handleImageError = async () => {
    const hash = getHashFromURL(url)
    if (!pubkey || !hash) {
      setIsLoading(false)
      setHasError(true)
      return
    }

    const blossomServerList = await client.fetchBlossomServerList(pubkey)
    const urls = blossomServerList.map((server) => server + hash).filter((u) => !triedUrls.has(u))
    const firstUrl = urls[0]
    if (!firstUrl) {
      setIsLoading(false)
      setHasError(true)
      return
    }

    setTriedUrls((prev) => new Set(prev.add(firstUrl)))
    setImageUrl(firstUrl)
  }

  return (
    <div className={cn('relative', classNames.wrapper)} {...props}>
      {isLoading && <Skeleton className={cn('absolute inset-0 rounded-lg', className)} />}
      {!hasError ? (
        <img
          src={imageUrl}
          alt={alt}
          className={cn(
            'object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          onLoad={() => {
            setIsLoading(false)
            setHasError(false)
            setTimeout(() => setDisplayBlurHash(false), 500)
          }}
          onError={handleImageError}
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
      )}
      {displayBlurHash && blurDataUrl && !hasError && (
        <img
          src={blurDataUrl}
          className={cn('absolute inset-0 object-cover w-full h-full -z-10', className)}
          alt={alt}
        />
      )}
    </div>
  )
}

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
function decodeBlurHashSize(blurHash: string) {
  const sizeValue = DIGITS.indexOf(blurHash[0])
  const numY = (sizeValue / 9 + 1) | 0
  const numX = (sizeValue % 9) + 1
  return { numX, numY }
}

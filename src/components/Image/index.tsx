import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TImageInfo } from '@/types'
import { decode } from 'blurhash'
import { HTMLAttributes, useEffect, useState } from 'react'

export default function Image({
  image: { url, blurHash },
  alt,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  image: TImageInfo
  alt?: string
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [displayBlurHash, setDisplayBlurHash] = useState(true)
  const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null)

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

  return (
    <div className={cn('relative', className)} {...props}>
      {isLoading && <Skeleton className={cn('absolute inset-0', className)} />}
      <img
        src={url}
        alt={alt}
        className={cn(
          'object-cover transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        onLoad={() => {
          setIsLoading(false)
          setTimeout(() => setDisplayBlurHash(false), 500)
        }}
      />
      {displayBlurHash && blurDataUrl && (
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

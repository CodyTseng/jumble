import { cn } from '@/lib/utils'
import { TEmoji } from '@/types'
import { HTMLAttributes, useState } from 'react'

export default function Emoji({
  emoji,
  className = ''
}: HTMLAttributes<HTMLDivElement> & {
  className?: string
  emoji: TEmoji
}) {
  const [hasError, setHasError] = useState(false)

  if (hasError) return `:${emoji.shortcode}:`

  return (
    <img
      src={emoji.url}
      alt={emoji.shortcode}
      className={cn('inline-block size-4', className)}
      onLoad={() => {
        setHasError(false)
      }}
      onError={() => {
        setHasError(true)
      }}
    />
  )
}

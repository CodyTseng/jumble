import { cn } from '@/lib/utils'
import { TEmoji } from '@/types'
import { Heart } from 'lucide-react'
import { HTMLAttributes, useState } from 'react'

export default function Emoji({
  emoji,
  classNames
}: Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {
  emoji: TEmoji | string
  classNames?: {
    text?: string
    img?: string
  }
}) {
  const [hasError, setHasError] = useState(false)

  if (typeof emoji === 'string') {
    return emoji === '+' ? (
      <Heart className={cn('size-5 text-red-400 fill-red-400', classNames?.img)} />
    ) : (
      <span className={cn('whitespace-nowrap', classNames?.text)}>{emoji}</span>
    )
  }

  if (hasError) {
    return (
      <span className={cn('whitespace-nowrap', classNames?.text)}>{`:${emoji.shortcode}:`}</span>
    )
  }

  return (
    <img
      src={emoji.url}
      alt={emoji.shortcode}
      draggable={false}
      className={cn('inline-block size-5 rounded-sm pointer-events-none', classNames?.img)}
      onLoad={() => {
        setHasError(false)
      }}
      onError={() => {
        setHasError(true)
      }}
    />
  )
}

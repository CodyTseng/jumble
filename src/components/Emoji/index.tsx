import { isInsecureUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import recentEmojiService from '@/services/recent-emoji.service'
import { TEmoji } from '@/types'
import { useSetAtom } from 'jotai'
import { Heart, ImageOff } from 'lucide-react'
import { HTMLAttributes, useState } from 'react'
import { emojiDetailAtom } from '../EmojiDetailDialog/atom'

export default function Emoji({
  emoji,
  classNames,
  clickable = false
}: Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {
  emoji: TEmoji | string
  classNames?: {
    text?: string
    img?: string
  }
  // When true, clicking a custom emoji opens the emoji detail dialog.
  clickable?: boolean
}) {
  const { allowInsecureConnection } = useUserPreferences()
  const [hasError, setHasError] = useState(false)
  const setEmojiDetail = useSetAtom(emojiDetailAtom)

  if (typeof emoji === 'string') {
    return emoji === '+' ? (
      <Heart className={cn('size-5 fill-red-400 text-red-400', classNames?.img)} />
    ) : (
      <span className={cn('whitespace-nowrap', classNames?.text)}>{emoji}</span>
    )
  }

  if (hasError || (!allowInsecureConnection && isInsecureUrl(emoji.url))) {
    if (!classNames?.text) {
      return (
        <span
          title={`:${emoji.shortcode}:`}
          className={cn(
            'text-muted-foreground inline-flex items-center justify-center align-middle',
            classNames?.img
          )}
        >
          <ImageOff className="size-1/2" />
        </span>
      )
    }
    return (
      <span className={cn('whitespace-nowrap', classNames?.text)}>{`:${emoji.shortcode}:`}</span>
    )
  }

  return (
    <img
      src={emoji.url}
      alt={emoji.shortcode}
      draggable={false}
      role={clickable ? 'button' : undefined}
      title={clickable ? `:${emoji.shortcode}:` : undefined}
      className={cn(
        'inline-block size-5',
        clickable ? 'cursor-pointer' : 'pointer-events-none',
        classNames?.img
      )}
      onClick={clickable ? () => setEmojiDetail(emoji) : undefined}
      onLoad={() => {
        setHasError(false)
      }}
      onError={() => {
        setHasError(true)
        recentEmojiService.markBroken(emoji.url)
      }}
    />
  )
}

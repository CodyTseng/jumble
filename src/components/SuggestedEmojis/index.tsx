import { Button } from '@/components/ui/button'
import recentEmojiService from '@/services/recent-emoji.service'
import { TEmoji } from '@/types'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import Emoji from '../Emoji'

const DEFAULT_SUGGESTED_EMOJIS = ['👍', '❤️', '😂', '🥲', '👀', '🫡', '🫂']

export default function SuggestedEmojis({
  onEmojiClick,
  onMoreButtonClick,
  maxSuggestions = 9
}: {
  onEmojiClick: (emoji: string | TEmoji) => void
  onMoreButtonClick: () => void
  maxSuggestions?: number
}) {
  const [suggestedEmojis, setSuggestedEmojis] = useState<(string | TEmoji)[]>(
    DEFAULT_SUGGESTED_EMOJIS.slice(0, maxSuggestions)
  )

  useEffect(() => {
    const recent = recentEmojiService.getRecent()
    const seen = new Set<string>()
    const merged = [...recent, ...DEFAULT_SUGGESTED_EMOJIS].filter((emoji) => {
      const key = typeof emoji === 'string' ? `n:${emoji}` : `c:${emoji.shortcode}|${emoji.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setSuggestedEmojis(merged.slice(0, maxSuggestions))
  }, [maxSuggestions])

  const handlePick = (emoji: string | TEmoji) => {
    recentEmojiService.add(emoji)
    onEmojiClick(emoji)
  }

  return (
    <div className="flex w-max gap-1 p-1" onClick={(e) => e.stopPropagation()}>
      <div
        className="clickable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl"
        onClick={() => onEmojiClick('+')}
      >
        <Emoji emoji="+" />
      </div>
      {suggestedEmojis.map((emoji, index) =>
        typeof emoji === 'string' ? (
          <div
            key={index}
            className="clickable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl"
            onClick={() => handlePick(emoji)}
          >
            {emoji}
          </div>
        ) : (
          <div
            className="clickable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            key={index}
            onClick={() => handlePick(emoji)}
          >
            <Emoji
              emoji={emoji}
              classNames={{ img: 'h-auto max-h-6 w-auto max-w-6 object-contain rounded-md' }}
            />
          </div>
        )
      )}
      <Button
        variant="ghost"
        className="text-muted-foreground h-8 w-8 shrink-0"
        onClick={onMoreButtonClick}
      >
        <MoreHorizontal size={24} />
      </Button>
    </div>
  )
}

import { Button } from '@/components/ui/button'
import { parseEmojiPickerUnified } from '@/lib/utils'
import { TEmoji } from '@/types'
import { getSuggested } from 'emoji-picker-react/src/dataUtils/suggested'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import Emoji from '../Emoji'

const DEFAULT_SUGGESTED_EMOJIS = ['👍', '❤️', '😂', '🥲', '👀', '🫡', '🫂']

export default function SuggestedEmojis({
  onEmojiClick,
  onMoreButtonClick
}: {
  onEmojiClick: (emoji: string | TEmoji) => void
  onMoreButtonClick: () => void
}) {
  const [suggestedEmojis, setSuggestedEmojis] =
    useState<(string | TEmoji)[]>(DEFAULT_SUGGESTED_EMOJIS)

  useEffect(() => {
    try {
      const suggested = getSuggested()
      const emojiSet = new Set<string>()
      const suggestEmojis = (
        suggested
          .sort((a, b) => b.count - a.count)
          .map((item) => parseEmojiPickerUnified(item.unified))
          .filter(Boolean) as (string | TEmoji)[]
      )
        .concat(DEFAULT_SUGGESTED_EMOJIS)
        .filter((emoji) => {
          if (typeof emoji !== 'string') return true
          if (emojiSet.has(emoji)) return false
          emojiSet.add(emoji)
          return true
        })
      setSuggestedEmojis(suggestEmojis.slice(0, 9))
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="flex gap-1 p-1" onClick={(e) => e.stopPropagation()}>
      <div
        className="w-8 h-8 rounded-lg clickable flex justify-center items-center text-xl"
        onClick={() => onEmojiClick('+')}
      >
        <Emoji emoji="+" />
      </div>
      {suggestedEmojis.map((emoji, index) =>
        typeof emoji === 'string' ? (
          <div
            key={index}
            className="w-8 h-8 rounded-lg clickable flex justify-center items-center text-xl"
            onClick={() => onEmojiClick(emoji)}
          >
            {emoji}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center p-1 rounded-lg clickable"
            key={index}
            onClick={() => onEmojiClick(emoji)}
          >
            <Emoji emoji={emoji} classNames={{ img: 'size-6 rounded-md' }} />
          </div>
        )
      )}
      <Button variant="ghost" className="w-8 h-8 text-muted-foreground" onClick={onMoreButtonClick}>
        <MoreHorizontal size={24} />
      </Button>
    </div>
  )
}

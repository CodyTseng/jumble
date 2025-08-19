import Emoji from '@/components/Emoji'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { TEmoji } from '@/types'
import { EmojiItem } from '@tiptap/extension-emoji'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

interface EmojiListProps {
  items: (TEmoji | EmojiItem)[]
  command: (params: { name: string }) => void
}

interface EmojiListRef {
  onKeyDown: (params: { event: KeyboardEvent }) => boolean
}

export const EmojiList = forwardRef<EmojiListRef, EmojiListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number): void => {
    const item = props.items[index]

    if (item) {
      props.command({ name: convertToName(item) })
    }
  }

  const upHandler = (): void => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = (): void => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = (): void => {
    selectItem(selectedIndex)
  }

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => {
    return {
      onKeyDown: (x: { event: KeyboardEvent }): boolean => {
        if (x.event.key === 'ArrowUp') {
          upHandler()
          return true
        }

        if (x.event.key === 'ArrowDown') {
          downHandler()
          return true
        }

        if (x.event.key === 'Enter') {
          enterHandler()
          return true
        }

        return false
      }
    }
  }, [upHandler, downHandler, enterHandler])

  return (
    <ScrollArea
      className="border rounded-lg bg-background z-50 pointer-events-auto flex flex-col max-h-80 overflow-y-auto"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {props.items.map((item, index) => (
        <button
          className={cn(
            'cursor-pointer text-start items-center m-1 p-2 outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-md',
            selectedIndex === index && 'bg-accent text-accent-foreground'
          )}
          key={getEmojiId(item)}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="flex gap-2 w-80 items-center truncate pointer-events-none">
            <Emoji
              emoji={formatEmoji(item)}
              classNames={{ img: 'size-6 shrink-0', text: 'w-6 text-center shrink-0' }}
            />
            <span className="truncate">{getEmojiId(item)}</span>
          </div>
        </button>
      ))}
    </ScrollArea>
  )
})

function getEmojiId(emoji: TEmoji | EmojiItem): string {
  if ((emoji as EmojiItem).name) {
    return `:${(emoji as EmojiItem).name}:`
  }
  return `:${emoji.shortcode}:`
}

function formatEmoji(emoji: TEmoji | EmojiItem) {
  if ((emoji as EmojiItem).name) {
    return (emoji as EmojiItem).emoji || (emoji as EmojiItem).name
  }
  return emoji as TEmoji
}

function convertToName(emoji: TEmoji | EmojiItem): string {
  if ((emoji as EmojiItem).name) {
    return (emoji as EmojiItem).emoji || (emoji as EmojiItem).name
  }
  return `:${(emoji as TEmoji).shortcode}:${(emoji as TEmoji).url}:`
}

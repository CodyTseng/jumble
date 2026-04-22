import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'

export interface MentionListProps {
  items: string[]
  command: (payload: { id: string; label?: string }) => void
}

export interface MentionListHandle {
  onKeyDown: (args: SuggestionKeyDownProps) => boolean
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  const selectItem = (index: number) => {
    const item = props.items[index]

    if (item) {
      props.command({ id: item, label: formatNpub(item) })
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    setSelectedIndex(props.items.length ? 0 : -1)
  }, [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter' && selectedIndex >= 0) {
        enterHandler()
        return true
      }

      return false
    }
  }))

  if (!props.items?.length) {
    return null
  }

  return (
    <ScrollArea
      className="pointer-events-auto z-50 flex max-h-80 flex-col overflow-y-auto rounded-lg border bg-background"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {props.items.map((item, index) => (
        <button
          className={cn(
            'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            selectedIndex === index && 'bg-accent text-accent-foreground'
          )}
          key={item}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
            <SimpleUserAvatar userId={item} />
            <div className="w-0 flex-1">
              <div className="flex items-center gap-2">
                <SimpleUsername userId={item} className="truncate font-semibold" />
                <FollowingBadge userId={item} />
              </div>
              <Nip05 pubkey={userIdToPubkey(item)} />
            </div>
          </div>
        </button>
      ))}
    </ScrollArea>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList

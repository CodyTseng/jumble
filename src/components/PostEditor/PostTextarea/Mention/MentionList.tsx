import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import nostrListsService from '@/services/nostr-lists.service'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { Users } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'

export interface MentionListProps {
  items: Array<{ type: 'user' | 'list'; id: string; data?: any }>
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
      if (item.type === 'list' && item.data) {
        const listMention = nostrListsService.generateListMention(item.data)
        props.command({ id: item.id, label: listMention })
      } else {
        props.command({ id: item.id, label: formatNpub(item.id) })
      }
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
          key={`${item.type}-${item.id}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="flex gap-2 w-80 items-center truncate pointer-events-none">
            {item.type === 'list' ? (
              <>
                <div className="flex items-center justify-center size-8 shrink-0 bg-muted rounded-full">
                  <Users className="size-4" />
                </div>
                <div className="flex-1 w-0">
                  <div className="font-semibold truncate">{item.data?.name || 'List'}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.data?.pubkeys?.length || 0} users
                  </div>
                </div>
              </>
            ) : (
              <>
                <SimpleUserAvatar userId={item.id} />
                <div className="flex-1 w-0">
                  <div className="flex items-center gap-2">
                    <SimpleUsername userId={item.id} className="font-semibold truncate" />
                    <FollowingBadge userId={item.id} />
                  </div>
                  <Nip05 pubkey={userIdToPubkey(item.id)} />
                </div>
              </>
            )}
          </div>
        </button>
      ))}
    </ScrollArea>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList

import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useFollowList } from '@/providers/FollowListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
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
  const { followingSet } = useFollowList()
  const { isUserTrusted } = useUserTrust()

  const items = useMemo(() => {
    const tier = (npub: string) => {
      const pubkey = userIdToPubkey(npub)
      if (followingSet.has(pubkey)) return 0
      if (isUserTrusted(pubkey)) return 1
      return 2
    }
    return props.items
      .map((item, idx) => ({ item, idx, tier: tier(item) }))
      .sort((a, b) => a.tier - b.tier || a.idx - b.idx)
      .map((x) => x.item)
  }, [props.items, followingSet, isUserTrusted])

  const selectItem = (index: number) => {
    const item = items[index]

    if (item) {
      props.command({ id: item, label: formatNpub(item) })
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + items.length - 1) % items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    setSelectedIndex(items.length ? 0 : -1)
  }, [items])

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

  if (!items.length) {
    return null
  }

  return (
    <ScrollArea
      className="pointer-events-auto z-50 flex max-h-80 flex-col overflow-y-auto rounded-lg border bg-background"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
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

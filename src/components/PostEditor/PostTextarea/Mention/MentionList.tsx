import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useFollowList } from '@/providers/FollowListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { List } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'

export type TMentionSuggestionItem =
  | {
      type: 'profile'
      id: string
    }
  | {
      type: 'people-list'
      id: string
      title: string
      author: string
      count: number
    }

export interface MentionListProps {
  items: TMentionSuggestionItem[]
  command: (payload: { id: string; label?: string }) => void
}

export interface MentionListHandle {
  onKeyDown: (args: SuggestionKeyDownProps) => boolean
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'profile' | 'people-list'>('profile')
  const { followingSet } = useFollowList()
  const { isUserTrusted } = useUserTrust()

  const profileItems = useMemo(() => {
    const tier = (npub: string) => {
      const pubkey = userIdToPubkey(npub)
      if (followingSet.has(pubkey)) return 0
      if (isUserTrusted(pubkey)) return 1
      return 2
    }
    return props.items
      .filter((item) => item.type === 'profile')
      .map((item, idx) => ({ item, idx, tier: tier(item.id) }))
      .sort((a, b) => a.tier - b.tier || a.idx - b.idx)
      .map((x) => x.item)
  }, [props.items, followingSet, isUserTrusted])
  const listItems = useMemo(
    () => props.items.filter((item) => item.type === 'people-list'),
    [props.items]
  )
  const showTabs = profileItems.length > 0 && listItems.length > 0
  const items = activeTab === 'people-list' ? listItems : profileItems

  const selectItem = (index: number) => {
    const item = items[index]

    if (item) {
      props.command({
        id: item.id,
        label: item.type === 'people-list' ? item.title : formatNpub(item.id)
      })
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

  useEffect(() => {
    if (activeTab === 'profile' && !profileItems.length && listItems.length) {
      setActiveTab('people-list')
    } else if (activeTab === 'people-list' && !listItems.length && profileItems.length) {
      setActiveTab('profile')
    }
  }, [activeTab, profileItems.length, listItems.length])

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
      {showTabs && (
        <div className="flex gap-1 border-b p-1">
          <button
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-sm',
              activeTab === 'profile' && 'bg-accent text-accent-foreground'
            )}
            onClick={() => setActiveTab('profile')}
          >
            Profiles
          </button>
          <button
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-sm',
              activeTab === 'people-list' && 'bg-accent text-accent-foreground'
            )}
            onClick={() => setActiveTab('people-list')}
          >
            Lists
          </button>
        </div>
      )}
      {items.map((item, index) =>
        item.type === 'people-list' ? (
          <PeopleListItem
            key={item.id}
            item={item}
            index={index}
            selectedIndex={selectedIndex}
            selectItem={selectItem}
            setSelectedIndex={setSelectedIndex}
          />
        ) : (
          <ProfileItem
            key={item.id}
            item={item}
            index={index}
            selectedIndex={selectedIndex}
            selectItem={selectItem}
            setSelectedIndex={setSelectedIndex}
          />
        )
      )}
    </ScrollArea>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList

function ProfileItem({
  item,
  index,
  selectedIndex,
  selectItem,
  setSelectedIndex
}: {
  item: Extract<TMentionSuggestionItem, { type: 'profile' }>
  index: number
  selectedIndex: number
  selectItem: (index: number) => void
  setSelectedIndex: (index: number) => void
}) {
  return (
    <button
      className={cn(
        'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        selectedIndex === index && 'bg-accent text-accent-foreground'
      )}
      onClick={() => selectItem(index)}
      onMouseEnter={() => setSelectedIndex(index)}
    >
      <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
        <SimpleUserAvatar userId={item.id} />
        <div className="w-0 flex-1">
          <div className="flex items-center gap-2">
            <SimpleUsername userId={item.id} className="truncate font-semibold" />
            <FollowingBadge userId={item.id} />
          </div>
          <Nip05 pubkey={userIdToPubkey(item.id)} />
        </div>
      </div>
    </button>
  )
}

function PeopleListItem({
  item,
  index,
  selectedIndex,
  selectItem,
  setSelectedIndex
}: {
  item: Extract<TMentionSuggestionItem, { type: 'people-list' }>
  index: number
  selectedIndex: number
  selectItem: (index: number) => void
  setSelectedIndex: (index: number) => void
}) {
  return (
    <button
      className={cn(
        'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        selectedIndex === index && 'bg-accent text-accent-foreground'
      )}
      onClick={() => selectItem(index)}
      onMouseEnter={() => setSelectedIndex(index)}
    >
      <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <List className="size-4" />
        </div>
        <div className="w-0 flex-1">
          <div className="truncate font-semibold">{item.title}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>{item.count} profiles</span>
            <span>by</span>
            <SimpleUsername userId={item.author} className="truncate" />
          </div>
        </div>
      </div>
    </button>
  )
}

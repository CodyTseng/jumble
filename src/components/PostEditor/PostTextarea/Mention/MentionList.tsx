import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { List } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'
import { TMentionTarget } from './types'

export interface MentionListProps {
  items: TMentionTarget[]
  command: (payload: { id: string; label?: string }) => void
}

export interface MentionListHandle {
  onKeyDown: (args: SuggestionKeyDownProps) => boolean
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const profileItems = props.items.filter((i) => i.type === 'profile')
  const listItems = props.items.filter((i) => i.type === 'list')
  const showTabs = profileItems.length > 0 && listItems.length > 0

  const [tab, setTab] = useState<'profiles' | 'lists'>(profileItems.length > 0 ? 'profiles' : 'lists')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  const activeItems = tab === 'profiles' ? profileItems : listItems

  const selectItem = (index: number) => {
    const item = activeItems[index]
    if (!item) return

    if (item.type === 'profile') {
      props.command({ id: item.id, label: formatNpub(item.id) })
    } else {
      props.command({ id: item.id, label: item.title })
    }
  }

  const upHandler = () => {
    if (!activeItems.length) return
    setSelectedIndex((selectedIndex + activeItems.length - 1) % activeItems.length)
  }

  const downHandler = () => {
    if (!activeItems.length) return
    setSelectedIndex((selectedIndex + 1) % activeItems.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    // Prefer keeping the active tab when possible, but auto-switch if it becomes empty.
    let nextTab = tab
    if (nextTab === 'profiles' && profileItems.length === 0 && listItems.length > 0) {
      nextTab = 'lists'
    } else if (nextTab === 'lists' && listItems.length === 0 && profileItems.length > 0) {
      nextTab = 'profiles'
    }
    if (nextTab !== tab) {
      setTab(nextTab)
    }
    const nextActiveItems = nextTab === 'profiles' ? profileItems : listItems
    setSelectedIndex(nextActiveItems.length ? 0 : -1)
  }, [props.items, tab])

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
      {showTabs ? (
        <div className="sticky top-0 z-10 border-b bg-background/90 p-2 backdrop-blur">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'profiles' | 'lists')}>
            <TabsList className="w-full">
              <TabsTrigger value="profiles" className="flex-1">
                Profiles
              </TabsTrigger>
              <TabsTrigger value="lists" className="flex-1">
                Lists
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      {activeItems.map((item, index) => {
        const selected = selectedIndex === index
        if (item.type === 'profile') {
          return (
            <button
              className={cn(
                'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                selected && 'bg-accent text-accent-foreground'
              )}
              key={`profile:${item.id}`}
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

        return (
          <button
            className={cn(
              'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
              selected && 'bg-accent text-accent-foreground'
            )}
            key={`list:${item.id}`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted/50">
                <List className="size-4" />
              </div>
              <div className="w-0 flex-1">
                <div className="truncate font-semibold">{item.title}</div>
                <div className="text-xs text-muted-foreground">{`${item.count} users`}</div>
              </div>
            </div>
          </button>
        )
      })}
    </ScrollArea>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList

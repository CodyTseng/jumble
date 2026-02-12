import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { List as ListIcon, Users } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'

export type TMentionSuggestionItem =
  | {
      type: 'profile'
      id: string
    }
  | {
      type: 'list'
      id: string // naddr1...
      title: string
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
  const [tab, setTab] = useState<'profiles' | 'lists'>('profiles')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  const profileItems = props.items.filter((item) => item.type === 'profile')
  const listItems = props.items.filter((item) => item.type === 'list')
  const activeItems = tab === 'lists' ? listItems : profileItems

  const selectItem = (index: number) => {
    const item = activeItems[index]
    if (!item) return

    if (item.type === 'profile') {
      props.command({ id: item.id, label: formatNpub(item.id) })
      return
    }

    props.command({ id: item.id, label: item.title })
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
    // If there are no items in the selected tab, fall back to the other tab.
    if (tab === 'lists' && listItems.length === 0 && profileItems.length > 0) {
      setTab('profiles')
    } else if (tab === 'profiles' && profileItems.length === 0 && listItems.length > 0) {
      setTab('lists')
    }
  }, [tab, listItems.length, profileItems.length])

  useEffect(() => {
    setSelectedIndex(activeItems.length ? 0 : -1)
  }, [activeItems.length])

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
    <div
      className="pointer-events-auto z-50 max-h-80 w-80 overflow-hidden rounded-lg border bg-background"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="border-b p-1">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'profiles' | 'lists')}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="profiles" className="flex w-full items-center gap-1">
              <Users className="size-4" />
              People
            </TabsTrigger>
            <TabsTrigger
              value="lists"
              className="flex w-full items-center gap-1"
              disabled={listItems.length === 0}
            >
              <ListIcon className="size-4" />
              Lists
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ScrollArea className="max-h-72">
        {activeItems.map((item, index) => {
          if (item.type === 'profile') {
            return (
              <button
                className={cn(
                  'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                  selectedIndex === index && 'bg-accent text-accent-foreground'
                )}
                key={`profile:${item.id}`}
                onClick={() => selectItem(index)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="pointer-events-none flex items-center gap-2 truncate">
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
                'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-none transition-colors',
                selectedIndex === index && 'bg-accent text-accent-foreground'
              )}
              key={`list:${item.id}`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="pointer-events-none flex items-center justify-between gap-2 truncate">
                <div className="min-w-0 flex-1 truncate font-semibold">{item.title}</div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {item.count.toLocaleString()} ppl
                </div>
              </div>
            </button>
          )
        })}
      </ScrollArea>
    </div>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList

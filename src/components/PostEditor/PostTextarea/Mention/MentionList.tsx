import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { List, UsersRound } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'
import type { TMentionSuggestionItem } from './suggestion'

export interface MentionListProps {
  items: TMentionSuggestionItem[]
  command: (payload: TMentionSuggestionItem) => void
}

export interface MentionListHandle {
  onKeyDown: (args: SuggestionKeyDownProps) => boolean
}

function getDefaultTab(profilesCount: number, listsCount: number) {
  if (profilesCount > 0) return 'profiles'
  if (listsCount > 0) return 'lists'
  return 'profiles'
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const profiles = useMemo(
    () => props.items.filter((i) => i.kind === 'profile'),
    [props.items]
  )
  const lists = useMemo(() => props.items.filter((i) => i.kind === 'list'), [props.items])

  const [tabValue, setTabValue] = useState<string>(getDefaultTab(profiles.length, lists.length))
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  useEffect(() => {
    setTabValue(getDefaultTab(profiles.length, lists.length))
    setSelectedIndex(profiles.length || lists.length ? 0 : -1)
  }, [profiles.length, lists.length])

  const activeItems = tabValue === 'lists' ? lists : profiles

  const selectItem = (index: number) => {
    const item = activeItems[index]
    if (item) {
      props.command(item)
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
    if (selectedIndex >= 0) {
      selectItem(selectedIndex)
    }
  }

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

  if (!profiles.length && !lists.length) {
    return null
  }

  return (
    <Tabs
      value={tabValue}
      onValueChange={(v) => {
        setTabValue(v)
        setSelectedIndex(0)
      }}
      className="pointer-events-auto z-50"
    >
      <TabsList className="mx-1 mt-1">
        <TabsTrigger value="profiles" disabled={!profiles.length}>
          Profiles
        </TabsTrigger>
        <TabsTrigger value="lists" disabled={!lists.length}>
          Lists
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profiles" className="mt-0">
        <ScrollArea
          className="flex max-h-80 flex-col overflow-y-auto rounded-lg border bg-background"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {profiles.map((item, index) => {
            const id = item.id
            return (
              <button
                className={cn(
                  'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                  tabValue === 'profiles' && selectedIndex === index && 'bg-accent text-accent-foreground'
                )}
                key={id}
                onClick={() => {
                  setSelectedIndex(index)
                  props.command(item)
                }}
                onMouseEnter={() => {
                  if (tabValue === 'profiles') setSelectedIndex(index)
                }}
              >
                <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
                  <SimpleUserAvatar userId={id} />
                  <div className="w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <SimpleUsername userId={id} className="truncate font-semibold" />
                      <FollowingBadge userId={id} />
                    </div>
                    <Nip05 pubkey={userIdToPubkey(id)} />
                  </div>
                </div>
              </button>
            )
          })}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="lists" className="mt-0">
        <ScrollArea
          className="flex max-h-80 flex-col overflow-y-auto rounded-lg border bg-background"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {lists.map((item, index) => {
            const key = (item.naddr && item.naddr.length > 0 ? item.naddr : item.name) || `list-${index}`
            return (
              <button
                className={cn(
                  'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                  tabValue === 'lists' && selectedIndex === index && 'bg-accent text-accent-foreground'
                )}
                key={key}
                onClick={() => {
                  setSelectedIndex(index)
                  props.command(item)
                }}
                onMouseEnter={() => {
                  if (tabValue === 'lists') setSelectedIndex(index)
                }}
              >
                <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/60">
                    <List className="h-4 w-4" />
                  </div>
                  <div className="w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{item.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <UsersRound className="mr-1 inline-block h-3 w-3" />
                      {item.members.length} {item.members.length === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
})

MentionList.displayName = 'MentionList'
export default MentionList

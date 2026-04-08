import FollowingBadge from '@/components/FollowingBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatNpub, pubkeyToNpub, userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { TMentionTarget } from '@/services/client.service'
import { Editor } from '@tiptap/core'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { Users } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import Nip05 from '../../../Nip05'
import { SimpleUserAvatar } from '../../../UserAvatar'
import { SimpleUsername } from '../../../Username'

export interface MentionListProps {
  items: TMentionTarget[]
  editor: Editor
  range: { from: number; to: number }
  command: (payload: { id: string; label?: string }) => void
}

export interface MentionListHandle {
  onKeyDown: (args: SuggestionKeyDownProps) => boolean
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'profile' | 'list'>('profile')

  const profileItems = props.items.filter((item) => item.type === 'profile')
  const listItems = props.items.filter((item) => item.type === 'list')
  const availableTabs = [
    profileItems.length > 0 ? 'profile' : undefined,
    listItems.length > 0 ? 'list' : undefined
  ].filter(Boolean) as ('profile' | 'list')[]
  const visibleItems =
    activeTab === 'list' && listItems.length > 0
      ? listItems
      : activeTab === 'profile'
        ? profileItems
        : []

  const selectItem = (index: number) => {
    const item = visibleItems[index]

    if (item) {
      if (item.type === 'profile') {
        props.command({ id: item.id, label: formatNpub(item.id) })
        return
      }

      const mentionNodes = Array.from(new Set(item.pubkeys))
        .map((pubkey) => pubkeyToNpub(pubkey))
        .filter(Boolean)
        .flatMap((npub) => [
          {
            type: 'mention',
            attrs: {
              id: npub!,
              label: formatNpub(npub!)
            }
          },
          {
            type: 'text',
            text: ' '
          }
        ])

      if (mentionNodes.length === 0) {
        return
      }

      props.editor
        .chain()
        .focus()
        .deleteRange(props.range)
        .insertContentAt(props.range.from, mentionNodes)
        .run()
    }
  }

  const upHandler = () => {
    if (!visibleItems.length) {
      return
    }
    setSelectedIndex((selectedIndex + visibleItems.length - 1) % visibleItems.length)
  }

  const downHandler = () => {
    if (!visibleItems.length) {
      return
    }
    setSelectedIndex((selectedIndex + 1) % visibleItems.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? 'profile')
    }
  }, [activeTab, availableTabs])

  useEffect(() => {
    setSelectedIndex(visibleItems.length ? 0 : -1)
  }, [activeTab, props.items, visibleItems.length])

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

      if (event.key === 'ArrowLeft' && availableTabs.length > 1) {
        setActiveTab(activeTab === 'profile' ? 'list' : 'profile')
        return true
      }

      if (event.key === 'ArrowRight' && availableTabs.length > 1) {
        setActiveTab(activeTab === 'list' ? 'profile' : 'list')
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
      {availableTabs.length > 1 && (
        <div className="flex gap-1 border-b px-2 py-2">
          <button
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              activeTab === 'profile'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('profile')}
          >
            Profiles
          </button>
          <button
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              activeTab === 'list'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('list')}
          >
            Lists
          </button>
        </div>
      )}
      {visibleItems.map((item, index) => (
        <button
          className={cn(
            'm-1 cursor-pointer items-center rounded-md p-2 text-start outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            selectedIndex === index && 'bg-accent text-accent-foreground'
          )}
          key={`${item.type}-${item.id}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {item.type === 'profile' ? (
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
          ) : (
            <div className="pointer-events-none flex w-80 items-center gap-2 truncate">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-4" />
              </div>
              <div className="w-0 flex-1">
                <div className="truncate font-semibold">{item.label}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {item.subtitle ?? `${item.pubkeys.length} profiles`}
                </div>
              </div>
            </div>
          )}
        </button>
      ))}
    </ScrollArea>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList

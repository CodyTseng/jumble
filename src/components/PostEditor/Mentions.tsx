import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import nostrListsService, { NostrList } from '@/services/nostr-lists.service'
import { Check, Users } from 'lucide-react'
import { Event, nip19 } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function Mentions({
  content,
  mentions,
  setMentions,
  parentEvent
}: {
  content: string
  mentions: string[]
  setMentions: (mentions: string[]) => void
  parentEvent?: Event
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { pubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const [potentialMentions, setPotentialMentions] = useState<string[]>([])
  const [parentEventPubkey, setParentEventPubkey] = useState<string | undefined>()
  const [removedPubkeys, setRemovedPubkeys] = useState<string[]>([])
  const [userLists, setUserLists] = useState<NostrList[]>([])
  const [potentialLists, setPotentialLists] = useState<NostrList[]>([])

  useEffect(() => {
    if (pubkey) {
      nostrListsService.fetchUserLists(pubkey).then(setUserLists)
    }
  }, [pubkey])

  useEffect(() => {
    extractMentions(content, parentEvent).then(({ pubkeys, relatedPubkeys, parentEventPubkey, lists }) => {
      const _parentEventPubkey = parentEventPubkey !== pubkey ? parentEventPubkey : undefined
      setParentEventPubkey(_parentEventPubkey)
      const potentialMentions = [...pubkeys, ...relatedPubkeys].filter((p) => p !== pubkey)
      if (_parentEventPubkey) {
        potentialMentions.push(_parentEventPubkey)
      }
      setPotentialMentions(potentialMentions)
      setPotentialLists(lists)
      setRemovedPubkeys((pubkeys) => {
        return Array.from(
          new Set(
            pubkeys
              .filter((p) => potentialMentions.includes(p))
              .concat(
                potentialMentions.filter((p) => mutePubkeySet.has(p) && p !== _parentEventPubkey)
              )
          )
        )
      })
    })
  }, [content, parentEvent, pubkey, mutePubkeySet])

  useEffect(() => {
    const newMentions = potentialMentions.filter((pubkey) => !removedPubkeys.includes(pubkey))
    setMentions(newMentions)
  }, [potentialMentions, removedPubkeys])

  const items = useMemo(() => {
    const userItems = potentialMentions.map((_, index) => {
      const pubkey = potentialMentions[potentialMentions.length - 1 - index]
      const isParentPubkey = pubkey === parentEventPubkey
      return (
        <MenuItem
          key={`user-${pubkey}-${index}`}
          checked={isParentPubkey ? true : mentions.includes(pubkey)}
          onCheckedChange={(checked) => {
            if (isParentPubkey) {
              return
            }
            if (checked) {
              setRemovedPubkeys((pubkeys) => pubkeys.filter((p) => p !== pubkey))
            } else {
              setRemovedPubkeys((pubkeys) => [...pubkeys, pubkey])
            }
          }}
          disabled={isParentPubkey}
        >
          <SimpleUserAvatar userId={pubkey} size="small" />
          <SimpleUsername
            userId={pubkey}
            className="font-semibold text-sm truncate"
            skeletonClassName="h-3"
          />
        </MenuItem>
      )
    })

    const listItems = potentialLists.map((list, index) => (
      <MenuItem
        key={`list-${list.id}-${index}`}
        checked={true}
        onCheckedChange={() => {}}
        disabled={true}
      >
        <div className="flex items-center justify-center size-6 shrink-0 bg-muted rounded-full">
          <Users className="size-3" />
        </div>
        <span className="font-semibold text-sm truncate">{list.name}</span>
        <span className="text-xs text-muted-foreground">({list.pubkeys.length} users)</span>
      </MenuItem>
    ))

    return [...listItems, ...userItems]
  }, [potentialMentions, potentialLists, parentEventPubkey, mentions])

  if (isSmallScreen) {
    return (
      <>
        <Button
          className="px-3"
          variant="ghost"
          disabled={potentialMentions.length === 0 && potentialLists.length === 0}
          onClick={() => setIsDrawerOpen(true)}
        >
          {t('Mentions')}{' '}
          {(potentialMentions.length > 0 || potentialLists.length > 0) && 
            `(${mentions.length + potentialLists.length}/${potentialMentions.length + potentialLists.length})`}
        </Button>
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerOverlay onClick={() => setIsDrawerOpen(false)} />
          <DrawerContent className="max-h-[80vh]" hideOverlay>
            <div
              className="overflow-y-auto overscroll-contain py-2"
              style={{ touchAction: 'pan-y' }}
            >
              {items}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="px-3"
          variant="ghost"
          disabled={potentialMentions.length === 0 && potentialLists.length === 0}
          onClick={(e) => e.stopPropagation()}
        >
          {t('Mentions')}{' '}
          {(potentialMentions.length > 0 || potentialLists.length > 0) && 
            `(${mentions.length + potentialLists.length}/${potentialMentions.length + potentialLists.length})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-96 max-h-[50vh]" showScrollButtons>
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuItem({
  children,
  checked,
  disabled,
  onCheckedChange
}: {
  children: React.ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <div
        onClick={() => {
          if (disabled) return
          onCheckedChange(!checked)
        }}
        className={cn(
          'flex items-center gap-2 px-4 py-3 clickable',
          disabled ? 'opacity-50 pointer-events-none' : ''
        )}
      >
        <div className="flex items-center justify-center size-4 shrink-0">
          {checked && <Check className="size-4" />}
        </div>
        {children}
      </div>
    )
  }

  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      disabled={disabled}
      onSelect={(e) => e.preventDefault()}
      onCheckedChange={onCheckedChange}
      className="flex items-center gap-2"
    >
      {children}
    </DropdownMenuCheckboxItem>
  )
}

async function extractMentions(content: string, parentEvent?: Event) {
  const parentEventPubkey = parentEvent ? parentEvent.pubkey : undefined
  const pubkeys: string[] = []
  const relatedPubkeys: string[] = []
  const lists: NostrList[] = []
  const matches = content.match(
    /nostr:(npub1[a-z0-9]{58}|nprofile1[a-z0-9]+|note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr1[a-z0-9]+)/g
  )

  const addToSet = (arr: string[], pubkey: string) => {
    if (pubkey === parentEventPubkey) return
    if (!arr.includes(pubkey)) arr.push(pubkey)
  }

  for (const m of matches || []) {
    try {
      const id = m.split(':')[1]
      const { type, data } = nip19.decode(id)
      if (type === 'nprofile') {
        addToSet(pubkeys, data.pubkey)
      } else if (type === 'npub') {
        addToSet(pubkeys, data)
      } else if (['nevent', 'note'].includes(type)) {
        const event = await client.fetchEvent(id)
        if (event) {
          addToSet(pubkeys, event.pubkey)
        }
      } else if (type === 'naddr') {
        // Handle list mentions
        const event = await client.fetchEvent(id)
        if (event && event.kind === 30000) {
          const list = nostrListsService.parseListEvent ? 
            nostrListsService.parseListEvent(event) : 
            {
              id: event.tags.find(t => t[0] === 'd')?.[1] || event.id,
              name: event.tags.find(t => t[0] === 'name')?.[1] || 'List',
              pubkeys: event.tags.filter(t => t[0] === 'p').map(t => t[1]),
              event
            }
          lists.push(list)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (parentEvent) {
    parentEvent.tags.forEach(([tagName, tagValue]) => {
      if (['p', 'P'].includes(tagName) && !!tagValue) {
        addToSet(relatedPubkeys, tagValue)
      }
    })
  }

  return {
    pubkeys,
    relatedPubkeys: relatedPubkeys.filter((p) => !pubkeys.includes(p)),
    parentEventPubkey,
    lists
  }
}

import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { isProtectedEvent } from '@/lib/event'
import { simplifyUrl } from '@/lib/url'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { Check } from 'lucide-react'
import { NostrEvent } from 'nostr-tools'
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'

type TPostTargetItem =
  | {
      type: 'writeRelays'
    }
  | {
      type: 'relay'
      url: string
    }
  | {
      type: 'relaySet'
      id: string
      urls: string[]
    }

export default function PostRelaySelector({
  parentEvent,
  openFrom,
  setIsProtectedEvent,
  setAdditionalRelayUrls
}: {
  parentEvent?: NostrEvent
  openFrom?: string[]
  setIsProtectedEvent: Dispatch<SetStateAction<boolean>>
  setAdditionalRelayUrls: Dispatch<SetStateAction<string[]>>
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { relayUrls } = useCurrentRelays()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const [postTargetItems, setPostTargetItems] = useState<TPostTargetItem[]>([])
  const parentEventSeenOnRelays = useMemo(() => {
    if (!parentEvent || !isProtectedEvent(parentEvent)) {
      return []
    }
    return client.getSeenEventRelayUrls(parentEvent.id)
  }, [parentEvent])
  const selectableRelays = useMemo(() => {
    return Array.from(new Set(parentEventSeenOnRelays.concat(relayUrls).concat(favoriteRelays)))
  }, [parentEventSeenOnRelays, relayUrls, favoriteRelays])
  const description = useMemo(() => {
    if (postTargetItems.length === 0) {
      return t('No relays selected')
    }
    if (postTargetItems.length === 1) {
      const item = postTargetItems[0]
      if (item.type === 'writeRelays') {
        return t('Write relays')
      }
      if (item.type === 'relay') {
        return simplifyUrl(item.url)
      }
      if (item.type === 'relaySet') {
        return item.urls.length > 1
          ? t('{{count}} relays', { count: item.urls.length })
          : simplifyUrl(item.urls[0])
      }
    }
    const hasWriteRelays = postTargetItems.some((item) => item.type === 'writeRelays')
    const relayCount = postTargetItems.reduce((count, item) => {
      if (item.type === 'relay') {
        return count + 1
      }
      if (item.type === 'relaySet') {
        return count + item.urls.length
      }
      return count
    }, 0)
    if (hasWriteRelays) {
      return t('Write relays and {{count}} other relays', { count: relayCount })
    }
    return t('{{count}} relays', { count: relayCount })
  }, [postTargetItems])

  useEffect(() => {
    if (openFrom && openFrom.length) {
      setPostTargetItems(Array.from(new Set(openFrom)).map((url) => ({ type: 'relay', url })))
      return
    }
    if (parentEventSeenOnRelays && parentEventSeenOnRelays.length) {
      setPostTargetItems(parentEventSeenOnRelays.map((url) => ({ type: 'relay', url })))
      return
    }
    setPostTargetItems([{ type: 'writeRelays' }])
  }, [openFrom, parentEventSeenOnRelays])

  useEffect(() => {
    const isProtectedEvent = postTargetItems.every((item) => item.type !== 'writeRelays')
    const relayUrls = postTargetItems.flatMap((item) => {
      if (item.type === 'relay') {
        return [item.url]
      }
      if (item.type === 'relaySet') {
        return item.urls
      }
      return []
    })

    setIsProtectedEvent(isProtectedEvent)
    setAdditionalRelayUrls(relayUrls)
  }, [postTargetItems])

  const handleWriteRelaysCheckedChange = useCallback((checked: boolean) => {
    if (checked) {
      setPostTargetItems((prev) => [...prev, { type: 'writeRelays' }])
    } else {
      setPostTargetItems((prev) => prev.filter((item) => item.type !== 'writeRelays'))
    }
  }, [])

  const handleRelayCheckedChange = useCallback((checked: boolean, url: string) => {
    if (checked) {
      setPostTargetItems((prev) => [...prev, { type: 'relay', url }])
    } else {
      setPostTargetItems((prev) =>
        prev.filter((item) => !(item.type === 'relay' && item.url === url))
      )
    }
  }, [])

  const handleRelaySetCheckedChange = useCallback(
    (checked: boolean, id: string, urls: string[]) => {
      if (checked) {
        setPostTargetItems((prev) => [...prev, { type: 'relaySet', id, urls }])
      } else {
        setPostTargetItems((prev) =>
          prev.filter((item) => !(item.type === 'relaySet' && item.id === id))
        )
      }
    },
    []
  )

  const content = useMemo(() => {
    return (
      <>
        <MenuItem
          checked={postTargetItems.some((item) => item.type === 'writeRelays')}
          onCheckedChange={handleWriteRelaysCheckedChange}
        >
          {t('Write relays')}
        </MenuItem>
        {relaySets.length > 0 && (
          <>
            <MenuSeparator />
            {relaySets
              .filter(({ relayUrls }) => relayUrls.length)
              .map(({ id, name, relayUrls }) => (
                <MenuItem
                  key={id}
                  checked={postTargetItems.some(
                    (item) => item.type === 'relaySet' && item.id === id
                  )}
                  onCheckedChange={(checked) => handleRelaySetCheckedChange(checked, id, relayUrls)}
                >
                  <div className="truncate">
                    {name} ({relayUrls.length})
                  </div>
                </MenuItem>
              ))}
          </>
        )}
        {selectableRelays.length > 0 && (
          <>
            <MenuSeparator />
            {selectableRelays.map((url) => (
              <MenuItem
                key={url}
                checked={postTargetItems.some((item) => item.type === 'relay' && item.url === url)}
                onCheckedChange={(checked) => handleRelayCheckedChange(checked, url)}
              >
                <div className="flex items-center gap-2">
                  <RelayIcon url={url} />
                  <div className="truncate">{simplifyUrl(url)}</div>
                </div>
              </MenuItem>
            ))}
          </>
        )}
      </>
    )
  }, [postTargetItems, relaySets, selectableRelays])

  if (isSmallScreen) {
    return (
      <>
        <div className="flex items-center gap-2">
          {t('Post to')}
          <Button
            variant="outline"
            className="px-2 flex-1 max-w-fit justify-start"
            onClick={() => setIsDrawerOpen(true)}
          >
            <div className="truncate">{description}</div>
          </Button>
        </div>
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerOverlay onClick={() => setIsDrawerOpen(false)} />
          <DrawerContent className="max-h-[80vh]" hideOverlay>
            <div
              className="overflow-y-auto overscroll-contain py-2"
              style={{ touchAction: 'pan-y' }}
            >
              {content}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu>
      <div className="flex items-center gap-2">
        {t('Post to')}
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="px-2 flex-1 max-w-fit justify-start">
            <div className="truncate">{description}</div>
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start" className="max-w-96 max-h-[50vh]" showScrollButtons>
        {content}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuSeparator() {
  const { isSmallScreen } = useScreenSize()
  if (isSmallScreen) {
    return <Separator />
  }
  return <DropdownMenuSeparator />
}

function MenuItem({
  children,
  checked,
  onCheckedChange
}: {
  children: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <div
        onClick={() => onCheckedChange(!checked)}
        className="flex items-center gap-2 px-4 py-3 clickable"
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
      onSelect={(e) => e.preventDefault()}
      onCheckedChange={onCheckedChange}
      className="flex items-center gap-2"
    >
      {children}
    </DropdownMenuCheckboxItem>
  )
}

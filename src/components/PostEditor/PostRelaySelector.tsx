import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ResponsiveMenu,
  ResponsiveMenuCheckboxItem,
  ResponsiveMenuContent,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { isProtectedEvent } from '@/lib/event'
import { simplifyUrl } from '@/lib/url'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import client from '@/services/client.service'
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
        return t('Optimal relays')
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
    const hasWriteRelays = postTargetItems.some(
      (item: TPostTargetItem) => item.type === 'writeRelays'
    )
    const relayCount = postTargetItems.reduce((count: number, item: TPostTargetItem) => {
      if (item.type === 'relay') {
        return count + 1
      }
      if (item.type === 'relaySet') {
        return count + item.urls.length
      }
      return count
    }, 0)
    if (hasWriteRelays) {
      return t('Optimal relays and {{count}} other relays', { count: relayCount })
    }
    return t('{{count}} relays', { count: relayCount })
  }, [postTargetItems, t])

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
    const isProtected = postTargetItems.every(
      (item: TPostTargetItem) => item.type !== 'writeRelays'
    )
    const relayUrls = postTargetItems.flatMap((item: TPostTargetItem) => {
      if (item.type === 'relay') {
        return [item.url]
      }
      if (item.type === 'relaySet') {
        return item.urls
      }
      return []
    })

    setIsProtectedEvent(isProtected)
    setAdditionalRelayUrls(relayUrls)
  }, [postTargetItems, setIsProtectedEvent, setAdditionalRelayUrls])

  const handleWriteRelaysCheckedChange = useCallback((checked: boolean) => {
    if (checked) {
      setPostTargetItems((prev: TPostTargetItem[]) => [...prev, { type: 'writeRelays' }])
    } else {
      setPostTargetItems((prev: TPostTargetItem[]) =>
        prev.filter((item: TPostTargetItem) => item.type !== 'writeRelays')
      )
    }
  }, [])

  const handleRelayCheckedChange = useCallback((checked: boolean, url: string) => {
    if (checked) {
      setPostTargetItems((prev: TPostTargetItem[]) => [...prev, { type: 'relay', url }])
    } else {
      setPostTargetItems((prev: TPostTargetItem[]) =>
        prev.filter((item: TPostTargetItem) => !(item.type === 'relay' && item.url === url))
      )
    }
  }, [])

  const handleRelaySetCheckedChange = useCallback(
    (checked: boolean, id: string, urls: string[]) => {
      if (checked) {
        setPostTargetItems((prev: TPostTargetItem[]) => [...prev, { type: 'relaySet', id, urls }])
      } else {
        setPostTargetItems((prev: TPostTargetItem[]) =>
          prev.filter((item: TPostTargetItem) => !(item.type === 'relaySet' && item.id === id))
        )
      }
    },
    []
  )

  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <div className="flex items-center gap-2 w-fit">
          <Label>{t('Post to')}</Label>
          <Button variant="outline" className="px-2 flex-1 max-w-fit justify-start">
            <div className="truncate">{description}</div>
          </Button>
        </div>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent align="start" className="max-w-96" showScrollButtons>
        <ResponsiveMenuCheckboxItem
          checked={postTargetItems.some((item: TPostTargetItem) => item.type === 'writeRelays')}
          onCheckedChange={handleWriteRelaysCheckedChange}
        >
          {t('Write relays')}
        </ResponsiveMenuCheckboxItem>
        {relaySets.length > 0 && (
          <>
            <ResponsiveMenuSeparator />
            {relaySets
              .filter(({ relayUrls }) => relayUrls.length)
              .map(({ id, name, relayUrls }) => (
                <ResponsiveMenuCheckboxItem
                  key={id}
                  checked={postTargetItems.some(
                    (item: TPostTargetItem) => item.type === 'relaySet' && item.id === id
                  )}
                  onCheckedChange={(checked) => handleRelaySetCheckedChange(checked, id, relayUrls)}
                >
                  <div className="truncate">
                    {name} ({relayUrls.length})
                  </div>
                </ResponsiveMenuCheckboxItem>
              ))}
          </>
        )}
        {selectableRelays.length > 0 && (
          <>
            <ResponsiveMenuSeparator />
            {selectableRelays.map((url) => (
              <ResponsiveMenuCheckboxItem
                key={url}
                checked={postTargetItems.some(
                  (item: TPostTargetItem) => item.type === 'relay' && item.url === url
                )}
                onCheckedChange={(checked) => handleRelayCheckedChange(checked, url)}
              >
                <div className="flex items-center gap-2">
                  <RelayIcon url={url} />
                  <div className="truncate">{simplifyUrl(url)}</div>
                </div>
              </ResponsiveMenuCheckboxItem>
            ))}
          </>
        )}
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}

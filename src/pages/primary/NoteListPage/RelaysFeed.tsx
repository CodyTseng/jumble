import NormalFeed from '@/components/NormalFeed'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { checkAlgoRelay } from '@/lib/relay'
import { useFeed } from '@/providers/FeedProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import storage from '@/services/local-storage.service'
import { Event } from 'nostr-tools'
import relayInfoService from '@/services/relay-info.service'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function RelaysFeed() {
  const { t } = useTranslation()
  const { relayUrls, feedInfo } = useFeed()
  const { followingSet } = useFollowList()
  const [isReady, setIsReady] = useState(false)
  const [areAlgoRelays, setAreAlgoRelays] = useState(false)
  const feedId = useMemo(() => {
    if (feedInfo?.feedType === 'relay' && feedInfo.id) {
      return `relay-${feedInfo.id}`
    } else if (feedInfo?.feedType === 'relays' && feedInfo.id) {
      return `relays-${feedInfo.id}`
    }
    return 'relays-default'
  }, [feedInfo])

  const [hideFollowedUsers, setHideFollowedUsers] = useState(() =>
    storage.getHideFollowedUsersForFeed(feedId)
  )

  useEffect(() => {
    setHideFollowedUsers(storage.getHideFollowedUsersForFeed(feedId))
  }, [feedId])

  useEffect(() => {
    const init = async () => {
      const relayInfos = await relayInfoService.getRelayInfos(relayUrls)
      setAreAlgoRelays(relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo)))
      setIsReady(true)
    }
    init()
  }, [relayUrls])

  const handleToggleChange = (checked: boolean) => {
    setHideFollowedUsers(checked)
    storage.setHideFollowedUsersForFeed(feedId, checked)
  }

  const filterFn = useMemo(() => {
    if (!hideFollowedUsers) return undefined
    return (event: Event) => !followingSet.has(event.pubkey)
  }, [hideFollowedUsers, followingSet])

  if (!isReady) {
    return null
  }

  return (
    <>
      <div className="px-4 py-3 flex items-center justify-between border-b">
        <Label htmlFor="hide-followed-feed" className="text-sm font-medium cursor-pointer">
          {t('Hide posts from followed users')}
        </Label>
        <Switch
          id="hide-followed-feed"
          checked={hideFollowedUsers}
          onCheckedChange={handleToggleChange}
        />
      </div>
      <NormalFeed
        feedId={feedId}
        subRequests={[{ urls: relayUrls, filter: {} }]}
        areAlgoRelays={areAlgoRelays}
        showRelayCloseReason
        filterFn={filterFn}
      />
    </>
  )
}

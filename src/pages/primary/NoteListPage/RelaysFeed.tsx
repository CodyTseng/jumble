import NormalFeed from '@/components/NormalFeed'
import { Button } from '@/components/ui/button'
import { checkAlgoRelay } from '@/lib/relay'
import { useFeed } from '@/providers/FeedProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import relayInfoService from '@/services/relay-info.service'
import { UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function RelaysFeed() {
  const { t } = useTranslation()
  const { relayUrls, feedInfo } = useFeed()
  const { followingSet } = useFollowList()
  const [isReady, setIsReady] = useState(false)
  const [areAlgoRelays, setAreAlgoRelays] = useState(false)
  const [hideFollowedUsers, setHideFollowedUsers] = useState(false)
  const feedId = useMemo(() => {
    if (feedInfo?.feedType === 'relay' && feedInfo.id) {
      return `relay-${feedInfo.id}`
    } else if (feedInfo?.feedType === 'relays' && feedInfo.id) {
      return `relays-${feedInfo.id}`
    }
    return 'relays-default'
  }, [feedInfo])

  useEffect(() => {
    const init = async () => {
      const relayInfos = await relayInfoService.getRelayInfos(relayUrls)
      setAreAlgoRelays(relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo)))
      setIsReady(true)
    }
    init()
  }, [relayUrls])

  if (!isReady) {
    return null
  }

  return (
    <NormalFeed
      feedId={feedId}
      subRequests={[{ urls: relayUrls, filter: {} }]}
      areAlgoRelays={areAlgoRelays}
      showRelayCloseReason
      filterFn={hideFollowedUsers ? (event) => !followingSet.has(event.pubkey) : undefined}
      extraOptions={
        followingSet.size > 0 ? (
          <Button
            variant="ghost"
            size="titlebar-icon"
            title={t('Hide followed users')}
            className={hideFollowedUsers ? 'bg-muted/40 text-foreground' : 'text-muted-foreground'}
            onClick={() => setHideFollowedUsers((value) => !value)}
          >
            <UsersRound />
          </Button>
        ) : null
      }
    />
  )
}

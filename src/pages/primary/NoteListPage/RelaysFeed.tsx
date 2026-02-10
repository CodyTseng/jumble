import NormalFeed from '@/components/NormalFeed'
import { Button } from '@/components/ui/button'
import { checkAlgoRelay } from '@/lib/relay'
import { useFeed } from '@/providers/FeedProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import relayInfoService from '@/services/relay-info.service'
import storage from '@/services/local-storage.service'
import { Event } from 'nostr-tools'
import { UserMinus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function RelaysFeed() {
  const { t } = useTranslation()
  const { relayUrls, feedInfo } = useFeed()
  const { pubkey } = useNostr()
  const { followingSet } = useFollowList()
  const [isReady, setIsReady] = useState(false)
  const [areAlgoRelays, setAreAlgoRelays] = useState(false)
  const relaySetId = useMemo(() => {
    return feedInfo?.feedType === 'relays' && feedInfo.id ? feedInfo.id : null
  }, [feedInfo])
  const [hideFollowing, setHideFollowing] = useState(false)
  const trustScoreFilterId = useMemo(() => {
    if (feedInfo?.feedType === 'relay' && feedInfo.id) {
      return `relay-${feedInfo.id}`
    } else if (feedInfo?.feedType === 'relays' && feedInfo.id) {
      return `relays-${feedInfo.id}`
    }
    return 'relays-default'
  }, [feedInfo])

  useEffect(() => {
    if (!relaySetId) {
      setHideFollowing(false)
      return
    }
    setHideFollowing(storage.getHideFollowingInRelaySet(relaySetId))
  }, [relaySetId])

  useEffect(() => {
    const init = async () => {
      const relayInfos = await relayInfoService.getRelayInfos(relayUrls)
      setAreAlgoRelays(relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo)))
      setIsReady(true)
    }
    init()
  }, [relayUrls])

  const canHideFollowing = !!pubkey && !!relaySetId && followingSet.size > 0
  const noteFilterFn = useMemo(() => {
    if (!canHideFollowing || !hideFollowing) return undefined
    return (evt: Event) => !followingSet.has(evt.pubkey)
  }, [canHideFollowing, hideFollowing, followingSet])

  if (!isReady) {
    return null
  }

  return (
    <NormalFeed
      trustScoreFilterId={trustScoreFilterId}
      subRequests={[{ urls: relayUrls, filter: {} }]}
      areAlgoRelays={areAlgoRelays}
      isMainFeed
      showRelayCloseReason
      noteFilterFn={noteFilterFn}
      extraOptions={
        canHideFollowing ? (
          <Button
            variant="ghost"
            size="titlebar-icon"
            className={
              hideFollowing
                ? 'text-primary hover:text-primary-hover'
                : 'text-muted-foreground hover:text-foreground'
            }
            title={t('Hide people you follow')}
            aria-label={t('Hide people you follow')}
            onClick={() => {
              const next = !hideFollowing
              setHideFollowing(next)
              if (relaySetId) {
                storage.setHideFollowingInRelaySet(relaySetId, next)
              }
            }}
          >
            <UserMinus size={16} />
          </Button>
        ) : null
      }
    />
  )
}

import NormalFeed from '@/components/NormalFeed'
import { Button } from '@/components/ui/button'
import { checkAlgoRelay } from '@/lib/relay'
import { cn } from '@/lib/utils'
import { useFeed } from '@/providers/FeedProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import relayInfoService from '@/services/relay-info.service'
import storage from '@/services/local-storage.service'
import { UserMinus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function RelaysFeed() {
  const { t } = useTranslation()
  const { relayUrls, feedInfo } = useFeed()
  const { followingSet } = useFollowList()
  const [isReady, setIsReady] = useState(false)
  const [areAlgoRelays, setAreAlgoRelays] = useState(false)
  const [hideFollowedAuthors, setHideFollowedAuthors] = useState(false)
  const feedId = useMemo(() => {
    if (feedInfo?.feedType === 'relay' && feedInfo.id) {
      return `relay-${feedInfo.id}`
    } else if (feedInfo?.feedType === 'relays' && feedInfo.id) {
      return `relays-${feedInfo.id}`
    }
    return 'relays-default'
  }, [feedInfo])

  useEffect(() => {
    setHideFollowedAuthors(storage.getHideFollowedAuthorsForFeed(feedId))
  }, [feedId])

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

  const hideFollowedAuthorsToggle =
    followingSet.size > 0 ? (
      <Button
        variant="ghost"
        size="titlebar-icon"
        title={t('Hide followed authors')}
        aria-label={t('Hide followed authors')}
        className={cn(
          hideFollowedAuthors
            ? 'bg-muted/40 text-primary hover:text-primary-hover'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => {
          const nextValue = !hideFollowedAuthors
          setHideFollowedAuthors(nextValue)
          storage.setHideFollowedAuthorsForFeed(feedId, nextValue)
        }}
      >
        <UserMinus size={16} />
      </Button>
    ) : null

  return (
    <NormalFeed
      feedId={feedId}
      subRequests={[{ urls: relayUrls, filter: {} }]}
      areAlgoRelays={areAlgoRelays}
      showRelayCloseReason
      hiddenAuthorPubkeys={hideFollowedAuthors ? followingSet : undefined}
      extraOptions={hideFollowedAuthorsToggle}
    />
  )
}

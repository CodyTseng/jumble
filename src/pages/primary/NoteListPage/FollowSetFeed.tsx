import NormalFeed from '@/components/NormalFeed'
import { Button } from '@/components/ui/button'
import { toFollowListSettings } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useFeed } from '@/providers/FeedProvider'
import { useFollowSets } from '@/providers/FollowSetsProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowSetFeed({ id }: { id: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { switchFeed } = useFeed()
  const { pubkey } = useNostr()
  const { followSets, isLoading } = useFollowSets()
  const set = followSets.find((set) => set.id === id)
  const [requests, setRequests] = useState<{ eventId: string; items: TFeedSubRequest[] }>()
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!set?.pubkeys.length) return
    let cancelled = false
    const load = async () => {
      let items: TFeedSubRequest[]
      try {
        items = await client.generateSubRequestsForPubkeys(set.pubkeys, set.event.pubkey)
      } catch (error) {
        console.warn('Could not resolve follow list relays', error)
        items = []
      }
      if (!cancelled) setRequests({ eventId: set.event.id, items })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [set, refresh])

  if (!set?.pubkeys.length) {
    return (
      <div className="text-muted-foreground space-y-3 px-4 pt-6 text-center text-sm">
        <p>
          {set
            ? t('No people in this follow list')
            : isLoading
              ? t('loading...')
              : t('Follow list unavailable')}
        </p>
        {!isLoading && (
          <div className="flex justify-center gap-2">
            {!set && pubkey && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => switchFeed('following', { pubkey })}
              >
                {t('Following')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => push(toFollowListSettings())}>
              {t('Follow lists')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <NormalFeed
      key={set.event.id}
      feedId={id}
      subRequests={requests?.eventId === set.event.id ? requests.items : []}
      onRefresh={() => setRefresh((count) => count + 1)}
      isPubkeyFeed
      hideTrustScoreFilter
    />
  )
}

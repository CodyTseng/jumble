import NormalFeed from '@/components/NormalFeed'
import { Button } from '@/components/ui/button'
import { usePrimaryPage } from '@/PageManager'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { Compass, Search, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowingFeed() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { followingSet } = useFollowList()
  const { navigate } = usePrimaryPage()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const [hasFollowings, setHasFollowings] = useState<boolean | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return

    async function init() {
      if (!pubkey) {
        setSubRequests([])
        setHasFollowings(null)
        return
      }

      const followings = await client.fetchFollowings(pubkey)
      setHasFollowings(followings.length > 0)
      setSubRequests(await client.generateSubRequestsForPubkeys([pubkey, ...followings], pubkey))

      if (followings.length) {
        initializedRef.current = true
      }
    }

    init()
  }, [pubkey, followingSet, refreshCount])

  // Show empty state when user has no followings
  if (hasFollowings === false && subRequests.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <UserPlus size={64} className="text-muted-foreground mb-4" strokeWidth={1.5} />
        <h2 className="text-2xl font-semibold mb-2">{t('Welcome to Jumble!')}</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {t(
            'Your feed is empty because you are not following anyone yet. Start by exploring interesting content and following users you like!'
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <Button size="lg" onClick={() => navigate('explore')} className="w-full">
            <Compass className="size-5" />
            {t('Explore')}
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('search')} className="w-full">
            <Search className="size-5" />
            {t('Search Users')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <NormalFeed
      subRequests={subRequests}
      onRefresh={() => {
        initializedRef.current = false
        setRefreshCount((count) => count + 1)
      }}
      isMainFeed
      isPubkeyFeed
    />
  )
}

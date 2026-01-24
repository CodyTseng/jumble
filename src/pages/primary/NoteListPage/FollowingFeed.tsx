import NormalFeed from '@/components/NormalFeed'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { useEffect, useState } from 'react'

export default function FollowingFeed({ forceLoad = false }: { forceLoad?: boolean }) {
  const { pubkey } = useNostr()
  const { feedInfo } = useFeed()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    async function init() {
      // Allow loading if forceLoad is true OR if feedType is 'following'
      const shouldLoad = forceLoad || feedInfo.feedType === 'following'

      if (!shouldLoad || !pubkey) {
        setSubRequests([])
        return
      }

      const followings = await client.fetchFollowings(pubkey)
      setSubRequests(await client.generateSubRequestsForPubkeys([pubkey, ...followings], pubkey))
    }

    init()
  }, [feedInfo.feedType, pubkey, forceLoad])

  return (
    <NormalFeed
      subRequests={subRequests}
      isMainFeed
      useProgressiveLoading
      eosePreset="DEFAULT"
    />
  )
}

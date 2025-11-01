import NormalFeed from '@/components/NormalFeed'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { useEffect, useState } from 'react'

export default function FollowingFeed() {
  const { pubkey } = useNostr()
  const { feedInfo } = useFeed()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    async function init() {
      if (feedInfo?.feedType !== 'following' || !pubkey) {
        setSubRequests([])
        return
      }

      const followings = await client.fetchFollowings(pubkey)
      setSubRequests(await client.generateSubRequestsForPubkeys([pubkey, ...followings], pubkey))
    }

    init()
  }, [feedInfo?.feedType, pubkey])

  return <NormalFeed subRequests={subRequests} isMainFeed />
}

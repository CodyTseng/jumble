import NormalFeed from '@/components/NormalFeed'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { useEffect, useState } from 'react'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'

export default function DomainFeed() {
  const { feedInfo } = useFeed()
  const { pubkey } = useNostr()
  const { communitySets } = useNip05Communities()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      setIsReady(false)
      try {
        let requests: TFeedSubRequest[] = []

        if (feedInfo.feedType === 'nip05-domain' && feedInfo.id) {
          // Single domain community feed
          requests = await client.generateSubRequestsForDomain(feedInfo.id, pubkey)
        } else if (feedInfo.feedType === 'nip05-domains' && feedInfo.id) {
          // Multiple domains community feed (community set)
          const communitySet = communitySets.find((set) => set.id === feedInfo.id)
          if (communitySet && communitySet.domains.length > 0) {
            requests = await client.generateSubRequestsForDomains(communitySet.domains, pubkey)
          }
        }

        setSubRequests(requests)
      } catch (error) {
        console.error('Error generating domain feed requests:', error)
        setSubRequests([])
      } finally {
        setIsReady(true)
      }
    }

    init()
  }, [feedInfo, pubkey, communitySets])

  if (!isReady) {
    return null
  }

  if (feedInfo.feedType !== 'nip05-domain' && feedInfo.feedType !== 'nip05-domains') {
    return null
  }

  if (subRequests.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground p-4">
        No members found for this community
      </div>
    )
  }

  return <NormalFeed subRequests={subRequests} isMainFeed showRelayCloseReason />
}

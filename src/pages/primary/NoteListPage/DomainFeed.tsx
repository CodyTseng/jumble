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

  useEffect(() => {
    async function init() {
      if (feedInfo.feedType !== 'nip05-domain' && feedInfo.feedType !== 'nip05-domains') {
        setSubRequests([])
        return
      }

      try {
        let requests: TFeedSubRequest[] = []

        if (feedInfo.feedType === 'nip05-domain' && feedInfo.id) {
          // Single domain community feed
          console.log('Fetching domain feed for:', feedInfo.id)
          requests = await client.generateSubRequestsForDomain(feedInfo.id, pubkey)
          console.log('Generated subRequests:', requests)
        } else if (feedInfo.feedType === 'nip05-domains' && feedInfo.id) {
          // Multiple domains community feed (community set)
          const communitySet = communitySets.find((set) => set.id === feedInfo.id)
          if (communitySet && communitySet.domains.length > 0) {
            console.log('Fetching domain feed for domains:', communitySet.domains)
            requests = await client.generateSubRequestsForDomains(communitySet.domains, pubkey)
            console.log('Generated subRequests:', requests)
          }
        }

        setSubRequests(requests)
      } catch (error) {
        console.error('Error generating domain feed requests:', error)
        setSubRequests([])
      }
    }

    init()
  }, [feedInfo, pubkey, communitySets])

  return <NormalFeed subRequests={subRequests} isMainFeed showRelayCloseReason />
}

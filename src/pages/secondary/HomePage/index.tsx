import { useFeed } from '@/providers/FeedProvider'
import { forwardRef } from 'react'
import ActiveCommunityMembers from './ActiveCommunityMembers'
import RecommendedRelays from './RecommendedRelays'

const HomePage = forwardRef(({ index }: { index?: number }, ref) => {
  const { feedInfo } = useFeed()

  // Show Active Community Members if on a domain community feed
  const showActiveCommunity =
    feedInfo.feedType === 'nip05-domain' || feedInfo.feedType === 'nip05-domains'

  console.log('[HomePage] RENDER - feedInfo:', feedInfo, 'showActiveCommunity:', showActiveCommunity)

  if (showActiveCommunity) {
    console.log('[HomePage] Rendering ActiveCommunityMembers')
    return <ActiveCommunityMembers ref={ref} index={index} />
  }

  // Otherwise show Recommended Relays
  console.log('[HomePage] Rendering RecommendedRelays')
  return <RecommendedRelays ref={ref} index={index} />
})
HomePage.displayName = 'HomePage'
export default HomePage

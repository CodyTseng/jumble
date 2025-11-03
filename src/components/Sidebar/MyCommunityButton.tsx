import { usePrimaryPage } from '@/PageManager'
import { Users } from 'lucide-react'
import SidebarItem from './SidebarItem'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'

export default function MyCommunityButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const { feedInfo } = useFeed()
  const { profile } = useNostr()

  // Only show if user has a NIP-05 community
  const hasCommunity = feedInfo.feedType === 'nip05-domain' && feedInfo.id && profile?.nip05

  if (!hasCommunity) {
    return null
  }

  return (
    <SidebarItem
      title="My Community"
      onClick={() => navigate('my-community')}
      active={display && current === 'my-community'}
      collapse={collapse}
    >
      <Users />
    </SidebarItem>
  )
}

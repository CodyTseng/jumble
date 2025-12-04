import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import { Users, PlusCircle } from 'lucide-react'
import SidebarItem from './SidebarItem'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'

export default function MyCommunityButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const { push } = useSecondaryPage()
  const { feedInfo } = useFeed()
  const { profile, checkLogin } = useNostr()

  // Check if user has a NIP-05 community
  const hasCommunity = feedInfo.feedType === 'nip05-domain' && feedInfo.id && profile?.nip05

  // Show "My Community" if user has NIP-05, otherwise show "Create Community"
  if (hasCommunity) {
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

  // Show "New Community" button when user doesn't have NIP-05
  return (
    <SidebarItem
      title="New Community"
      onClick={() => checkLogin(() => push('/communities/create'))}
      collapse={collapse}
    >
      <PlusCircle />
    </SidebarItem>
  )
}

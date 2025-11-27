import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { PlusCircle, Settings } from 'lucide-react'
import SidebarItem from './SidebarItem'
import { useFeed } from '@/providers/FeedProvider'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import { useEffect, useState } from 'react'
import nip05CommunityService from '@/services/nip05-community.service'

export default function CreateCommunityButton({ collapse }: { collapse: boolean }) {
  const { push } = useSecondaryPage()
  const { checkLogin, profile, pubkey } = useNostr()
  const { feedInfo } = useFeed()
  const [isAdmin, setIsAdmin] = useState(false)

  const domain = feedInfo.feedType === 'nip05-domain' ? feedInfo.id : null

  useEffect(() => {
    const checkAdmin = async () => {
      if (!domain || !pubkey || !profile?.nip05) {
        setIsAdmin(false)
        return
      }

      try {
        // Get members from the domain (uses cache if available)
        const members = await nip05CommunityService.getDomainMembers(domain)

        // User is admin if they're the first member
        setIsAdmin(members.length > 0 && members[0] === pubkey)
      } catch (error) {
        console.error('[CreateCommunityButton] Error checking admin status:', error)
        setIsAdmin(false)
      }
    }

    checkAdmin()
  }, [domain, pubkey, profile?.nip05])

  return (
    <SidebarItem
      title={isAdmin ? "Manage Community" : "Create A Community"}
      onClick={() => checkLogin(() => push('/communities/create'))}
      collapse={collapse}
    >
      {isAdmin ? <Settings /> : <PlusCircle />}
    </SidebarItem>
  )
}

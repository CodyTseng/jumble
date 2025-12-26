import ActiveMemberBadge from '@/components/ActiveMemberBadge'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toExplore } from '@/lib/link'
import { usePrimaryPage } from '@/PageManager'
import { useFeed } from '@/providers/FeedProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import nip05CommunityService from '@/services/nip05-community.service'
import userActivityService, { TUserActivity } from '@/services/user-activity.service'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ActiveCommunityMembers = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { navigate } = usePrimaryPage()
  const { feedInfo } = useFeed()
  const { followingSet } = useFollowList()
  const [topMembers, setTopMembers] = useState<TUserActivity[]>([])
  const [loading, setLoading] = useState(true)

  console.log('[ActiveCommunityMembers] RENDER - feedInfo:', feedInfo, 'topMembers:', topMembers.length, 'loading:', loading)

  useEffect(() => {
    console.log('[ActiveCommunityMembers] useEffect TRIGGERED - feedInfo:', feedInfo)
    const init = async () => {
      try {
        setLoading(true)

        let members: string[] = []

        // Check if we're on a domain community feed
        if (feedInfo.feedType === 'nip05-domain' || feedInfo.feedType === 'nip05-domains') {
          // Get community domain
          const domain = feedInfo.id
          console.log('[ActiveCommunityMembers] Domain feed - Domain:', domain)
          if (!domain) {
            console.log('[ActiveCommunityMembers] No domain found')
            setTopMembers([])
            setLoading(false)
            return
          }

          // Fetch community members
          console.log('[ActiveCommunityMembers] Fetching members for domain:', domain)
          members = await nip05CommunityService.getDomainMembers(domain)
          console.log('[ActiveCommunityMembers] Fetched domain members:', members.length, members)
        } else {
          // Use follow list for non-domain feeds
          console.log('[ActiveCommunityMembers] Non-domain feed - using follow list')
          members = Array.from(followingSet)
          console.log('[ActiveCommunityMembers] Follow list members:', members.length, members)
        }

        if (members.length === 0) {
          console.log('[ActiveCommunityMembers] No members found')
          setTopMembers([])
          setLoading(false)
          return
        }

        // Get activity stats and sort
        console.log('[ActiveCommunityMembers] Fetching activity stats for', members.length, 'members')
        const topActiveMembers = await userActivityService.getTopActiveMembers(members, 10)
        console.log('[ActiveCommunityMembers] Top active members:', topActiveMembers)

        // If API failed and we got no results, show members anyway with noteCount: 0
        if (topActiveMembers.length === 0 && members.length > 0) {
          console.log('[ActiveCommunityMembers] API failed, showing members without activity data')
          const fallbackMembers = members.slice(0, 10).map(pubkey => ({
            pubkey,
            noteCount: 0,
            followerCount: 0,
            lastFetched: Date.now()
          }))
          setTopMembers(fallbackMembers)
        } else {
          setTopMembers(topActiveMembers)
        }
      } catch (error) {
        console.error('[ActiveCommunityMembers] Error fetching active community members:', error)
        setTopMembers([])
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [feedInfo.feedType, feedInfo.id, followingSet])

  if (loading) {
    return (
      <SecondaryPageLayout ref={ref} index={index} hideBackButton hideTitlebarBottomBorder>
        <div className="text-muted-foreground w-full h-screen flex items-center justify-center">
          {t('loading...')}
        </div>
      </SecondaryPageLayout>
    )
  }

  if (topMembers.length === 0) {
    return (
      <SecondaryPageLayout ref={ref} index={index} hideBackButton hideTitlebarBottomBorder>
        <div className="text-muted-foreground w-full h-screen flex items-center justify-center">
          {t('No active members found')}
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={
        <>
          <TrendingUp />
          <div>{t('Active Community Members')}</div>
        </>
      }
      hideBackButton
      hideTitlebarBottomBorder
    >
      <div className="px-4 pt-2 pb-8">
        <div className="space-y-2">
          {topMembers.map((activity, idx) => (
            <ActiveMemberBadge key={activity.pubkey} activity={activity} rank={idx + 1} />
          ))}
        </div>
        <div className="flex mt-4 justify-center">
          <Button variant="ghost" onClick={() => navigate('explore')}>
            <div>{t('Explore more')}</div>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
ActiveCommunityMembers.displayName = 'ActiveCommunityMembers'
export default ActiveCommunityMembers

import DiscoverCommunities from '@/components/DiscoverCommunities'
import CommunityProfiles from '@/components/CommunityProfiles'
import FollowingFavoriteDomainList from '@/components/FollowingFavoriteDomainList'
import Tabs from '@/components/Tabs'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Compass, Plus } from 'lucide-react'
import { forwardRef, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TExploreTabs = 'discover' | 'profiles' | 'following'

const ExplorePage = forwardRef((_, ref) => {
  const [tab, setTab] = useState<TExploreTabs>('discover')

  const content = useMemo(() => {
    return tab === 'discover' ? (
      <DiscoverCommunities />
    ) : tab === 'profiles' ? (
      <CommunityProfiles />
    ) : (
      <FollowingFavoriteDomainList />
    )
  }, [tab])

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="explore"
      titlebar={<ExplorePageTitlebar />}
      displayScrollToTopButton
    >
      <Tabs
        value={tab}
        tabs={[
          { value: 'discover', label: 'Discover Communities' },
          { value: 'profiles', label: 'Community Profiles' },
          { value: 'following', label: "Following's Domains" }
        ]}
        onTabChange={(tab) => setTab(tab as TExploreTabs)}
      />
      {content}
    </PrimaryPageLayout>
  )
})
ExplorePage.displayName = 'ExplorePage'
export default ExplorePage

function ExplorePageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 justify-between h-full">
      <div className="flex gap-2 items-center h-full pl-3">
        <Compass />
        <div className="text-lg font-semibold">{t('Explore')}</div>
      </div>
      <Button
        variant="ghost"
        size="titlebar-icon"
        className="relative w-fit px-3"
        onClick={() => {
          window.open(
            'https://github.com/nostr-protocol/nips/blob/master/05.md',
            '_blank'
          )
        }}
      >
        <Plus size={16} />
        {t('Add Community')}
      </Button>
    </div>
  )
}

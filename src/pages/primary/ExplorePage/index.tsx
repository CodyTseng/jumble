import FollowingFavoriteRelayList from '@/components/FollowingFavoriteRelayList'
import RelayList from '@/components/RelayList'
import TabSwitcher from '@/components/TabSwitch'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Compass } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TExploreTabs = 'following' | 'all'

const ExplorePage = forwardRef((_, ref) => {
  const [tab, setTab] = useState<TExploreTabs>('following')

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="explore"
      titlebar={<ExplorePageTitlebar />}
      displayScrollToTopButton
    >
      <TabSwitcher
        value={tab}
        tabs={[
          { value: 'following', label: "Following's Favorites" },
          { value: 'all', label: 'All' }
        ]}
        onTabChange={(tab) => setTab(tab as TExploreTabs)}
      />
      {tab === 'following' ? <FollowingFavoriteRelayList /> : <RelayList />}
    </PrimaryPageLayout>
  )
})
ExplorePage.displayName = 'ExplorePage'
export default ExplorePage

function ExplorePageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <Compass />
      <div className="text-lg font-semibold">{t('Explore')}</div>
    </div>
  )
}

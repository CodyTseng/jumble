import FollowingFavoriteDomainList from '@/components/FollowingFavoriteDomainList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TCommunitySizeTab = 'small' | 'medium' | 'large'

const ExplorePage = forwardRef((_, ref) => {
  const [activeTab, setActiveTab] = useState<TCommunitySizeTab>('small')

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="explore"
      titlebar={<ExplorePageTitlebar activeTab={activeTab} onTabChange={setActiveTab} />}
      displayScrollToTopButton
    >
      <FollowingFavoriteDomainList sizeFilter={activeTab} />
    </PrimaryPageLayout>
  )
})
ExplorePage.displayName = 'ExplorePage'
export default ExplorePage

function ExplorePageTitlebar({
  activeTab,
  onTabChange
}: {
  activeTab: TCommunitySizeTab
  onTabChange: (tab: TCommunitySizeTab) => void
}) {
  const { t } = useTranslation()

  const tabs = [
    { value: 'small' as TCommunitySizeTab, label: 'Small' },
    { value: 'medium' as TCommunitySizeTab, label: 'Medium' },
    { value: 'large' as TCommunitySizeTab, label: 'Large' }
  ]

  return (
    <div className="flex gap-1 items-center h-full justify-center flex-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={`px-6 py-1 text-sm font-semibold rounded-lg transition-all flex-1 max-w-[200px] ${
            activeTab === tab.value
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(tab.label)}
        </button>
      ))}
    </div>
  )
}

import Explore from '@/components/Explore'
import FollowingFavoriteRelayList from '@/components/FollowingFavoriteRelayList'
import PinButton from '@/components/PinButton'
import Tabs from '@/components/Tabs'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Compass, Plus } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TExploreTabs = 'following' | 'explore'

const ExplorePage = forwardRef((_, ref) => {
  const [tab, setTab] = useState<TExploreTabs>('explore')

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
          { value: 'explore', label: 'Explore' },
          { value: 'following', label: "Following's Favorites" }
        ]}
        onTabChange={(tab) => setTab(tab as TExploreTabs)}
      />
      {tab === 'following' ? <FollowingFavoriteRelayList /> : <Explore />}
    </PrimaryPageLayout>
  )
})
ExplorePage.displayName = 'ExplorePage'
export default ExplorePage

function ExplorePageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 justify-between h-full">
      <div className="flex gap-2 items-center h-full pl-3 [&_svg]:text-muted-foreground">
        <Compass />
        <div className="text-lg font-semibold" style={{ fontSize: `var(--title-font-size, 18px)` }}>{t('Explore')}</div>
      </div>
      <div className="flex gap-1 items-center">
        <PinButton column={{ type: 'explore' }} size="titlebar-icon" />
        <Button
          variant="ghost"
          size="titlebar-icon"
          className="relative w-fit px-3"
          onClick={() => {
            window.open(
              'https://github.com/CodyTseng/awesome-nostr-relays/issues/new?template=add-relay.md',
              '_blank'
            )
          }}
        >
          <Plus size={16} />
          {t('Submit Relay')}
        </Button>
      </div>
    </div>
  )
}

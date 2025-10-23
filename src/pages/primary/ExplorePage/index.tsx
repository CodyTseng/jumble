import Explore from '@/components/Explore'
import FollowingFavoriteRelayList from '@/components/FollowingFavoriteRelayList'
import NoteList from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { Button } from '@/components/ui/button'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { Compass, Plus } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TExploreTabs = 'following' | 'explore' | 'reviews'

const ExplorePage = forwardRef((_, ref) => {
  const { hideUntrustedNotes } = useUserTrust()
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
          { value: 'reviews', label: 'Reviews' },
          { value: 'following', label: "Following's Favorites" }
        ]}
        onTabChange={(tab) => setTab(tab as TExploreTabs)}
      />
      {tab === 'explore' ? (
        <Explore />
      ) : tab === 'reviews' ? (
        <NoteList
          showKinds={[ExtendedKind.RELAY_REVIEW]}
          subRequests={[{ urls: BIG_RELAY_URLS, filter: {} }]}
          filterMutedNotes
          hideUntrustedNotes={hideUntrustedNotes}
        />
      ) : (
        <FollowingFavoriteRelayList />
      )}
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
            'https://github.com/CodyTseng/awesome-nostr-relays/issues/new?template=add-relay.md',
            '_blank'
          )
        }}
      >
        <Plus size={16} />
        {t('Submit Relay')}
      </Button>
    </div>
  )
}

import Explore from '@/components/Explore'
import FollowingFavoriteRelayList from '@/components/FollowingFavoriteRelayList'
import NoteList from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { Button } from '@/components/ui/button'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { getReplaceableEventIdentifier } from '@/lib/event'
import { isLocalNetworkUrl, isOnionUrl, isWebsocketUrl } from '@/lib/url'
import storage from '@/services/local-storage.service'
import { TPageRef } from '@/types'
import { Compass, Plus } from 'lucide-react'
import { NostrEvent } from 'nostr-tools'
import { forwardRef, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TExploreTabs = 'following' | 'explore' | 'reviews'

const ExplorePage = forwardRef<TPageRef>((_, ref) => {
  const [tab, setTab] = useState<TExploreTabs>('explore')
  const topRef = useRef<HTMLDivElement | null>(null)

  const relayReviewFilterFn = useCallback((evt: NostrEvent) => {
    const d = getReplaceableEventIdentifier(evt)
    if (!d) return false

    if (!isWebsocketUrl(d)) {
      return false
    }
    if (isLocalNetworkUrl(d)) {
      return false
    }
    if (storage.getFilterOutOnionRelays() && isOnionUrl(d)) {
      return false
    }
    return true
  }, [])

  const content = useMemo(() => {
    return tab === 'explore' ? (
      <Explore />
    ) : tab === 'reviews' ? (
      <NoteList
        showKinds={[ExtendedKind.RELAY_REVIEW]}
        subRequests={[{ urls: BIG_RELAY_URLS, filter: {} }]}
        filterFn={relayReviewFilterFn}
        filterMutedNotes
        hideSpam
      />
    ) : (
      <FollowingFavoriteRelayList />
    )
  }, [tab, relayReviewFilterFn])

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
        onTabChange={(tab) => {
          setTab(tab as TExploreTabs)
          topRef.current?.scrollIntoView({ behavior: 'instant' })
        }}
      />
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
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

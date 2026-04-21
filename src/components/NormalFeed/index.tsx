import FeedTabsCustomizeDialog from '@/components/FeedTabsCustomizeDialog'
import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import TrustScoreFilter from '@/components/TrustScoreFilter'
import UserAggregationList, { TUserAggregationListRef } from '@/components/UserAggregationList'
import { SPECIAL_FEED_ID } from '@/constants'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest, TFeedTabConfig } from '@/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import KindFilter from '../KindFilter'
import { RefreshButton } from '../RefreshButton'

export default function NormalFeed({
  feedId,
  subRequests,
  areAlgoRelays = false,
  isMainFeed = false,
  showRelayCloseReason = false,
  disable24hMode = false,
  onRefresh,
  isPubkeyFeed = false
}: {
  feedId: string
  subRequests: TFeedSubRequest[]
  areAlgoRelays?: boolean
  isMainFeed?: boolean
  showRelayCloseReason?: boolean
  disable24hMode?: boolean
  onRefresh?: () => void
  isPubkeyFeed?: boolean
}) {
  const { getShowKinds } = useKindFilter()
  const { getMinTrustScore } = useUserTrust()
  const { feedTabs } = useUserPreferences()
  const feedShowKinds = useMemo(() => getShowKinds(feedId), [getShowKinds, feedId])
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(feedShowKinds)

  const visibleTabs = useMemo(
    () =>
      feedTabs.filter(
        (tab) => !tab.hidden && !(tab.builtin === '24h' && disable24hMode)
      ),
    [feedTabs, disable24hMode]
  )

  const [selectedTabId, setSelectedTabId] = useState<string>(
    () => storage.getNoteListMode() || 'posts'
  )
  const selectedTab: TFeedTabConfig | undefined =
    visibleTabs.find((tab) => tab.id === selectedTabId) ?? visibleTabs[0]

  useEffect(() => {
    if (selectedTab && selectedTab.id !== selectedTabId) {
      setSelectedTabId(selectedTab.id)
    }
  }, [selectedTab, selectedTabId])

  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)
  const userAggregationListRef = useRef<TUserAggregationListRef>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const subRequestsHaveKinds = useMemo(() => {
    return subRequests.some((req) => !!req.filter.kinds?.length)
  }, [subRequests])
  const [trustFilterOpen, setTrustFilterOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const showTrustScoreFilter =
    feedId !== SPECIAL_FEED_ID.FOLLOWING && feedId !== SPECIAL_FEED_ID.PINNED
  const trustScoreThreshold = useMemo(() => {
    return showTrustScoreFilter ? getMinTrustScore(feedId) : undefined
  }, [feedId, showTrustScoreFilter, getMinTrustScore])

  const tabHasFixedKinds = !!selectedTab?.kinds
  const is24hMode = selectedTab?.builtin === '24h'
  const effectiveShowKinds = selectedTab?.kinds ?? temporaryShowKinds
  const hideReplies = selectedTab?.hideReplies ?? false

  useEffect(() => {
    setTemporaryShowKinds(feedShowKinds)
  }, [feedShowKinds])

  const handleListModeChange = (mode: string) => {
    setSelectedTabId(mode)
    if (isMainFeed) {
      storage.setNoteListMode(mode)
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleShowKindsChange = (newShowKinds: number[]) => {
    setTemporaryShowKinds(newShowKinds)
    noteListRef.current?.scrollToTop()
  }

  const handleTrustFilterOpenChange = (open: boolean) => {
    setTrustFilterOpen(open)
  }

  return (
    <>
      <Tabs
        value={selectedTab?.id ?? ''}
        tabs={visibleTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
        onTabChange={handleListModeChange}
        onCustomize={() => setCustomizeOpen(true)}
        options={
          <>
            {!supportTouch && (
              <RefreshButton
                onClick={() => {
                  if (onRefresh) {
                    onRefresh()
                    return
                  }
                  if (is24hMode) {
                    userAggregationListRef.current?.refresh()
                  } else {
                    noteListRef.current?.refresh()
                  }
                }}
              />
            )}
            {showTrustScoreFilter && (
              <TrustScoreFilter filterId={feedId} onOpenChange={handleTrustFilterOpenChange} />
            )}
            {!subRequestsHaveKinds && !tabHasFixedKinds && (
              <KindFilter
                feedId={feedId}
                showKinds={temporaryShowKinds}
                onShowKindsChange={handleShowKindsChange}
              />
            )}
          </>
        }
        active={trustFilterOpen}
      />
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
      {selectedTab ? (
        is24hMode ? (
          <UserAggregationList
            ref={userAggregationListRef}
            showKinds={effectiveShowKinds}
            subRequests={subRequests}
            areAlgoRelays={areAlgoRelays}
            showRelayCloseReason={showRelayCloseReason}
            isPubkeyFeed={isPubkeyFeed}
            trustScoreThreshold={trustScoreThreshold}
          />
        ) : (
          <NoteList
            ref={noteListRef}
            showKinds={effectiveShowKinds}
            subRequests={subRequests}
            hideReplies={hideReplies}
            areAlgoRelays={areAlgoRelays}
            showRelayCloseReason={showRelayCloseReason}
            isPubkeyFeed={isPubkeyFeed}
            trustScoreThreshold={trustScoreThreshold}
          />
        )
      ) : null}
      <FeedTabsCustomizeDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </>
  )
}

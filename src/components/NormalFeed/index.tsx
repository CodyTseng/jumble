import DeepPulseList, { TDeepPulseListRef } from '@/components/DeepPulseList'
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
import { TFeedSubRequest, TFeedTabConfig } from '@/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import KindFilter from '../KindFilter'
import { RefreshButton } from '../RefreshButton'

export default function NormalFeed({
  feedId,
  subRequests,
  areAlgoRelays = false,
  showRelayCloseReason = false,
  disable24hMode = false,
  onRefresh,
  isPubkeyFeed = false
}: {
  feedId: string
  subRequests: TFeedSubRequest[]
  areAlgoRelays?: boolean
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

  // `disable24hMode` is used by hashtag/search secondary feeds where there
  // are no stable authors, so per-author aggregation (24h Pulse + deep Pulse)
  // doesn't make sense. We treat both aggregation builtins the same here.
  const visibleTabs = useMemo(
    () =>
      feedTabs.filter(
        (tab) =>
          !tab.hidden &&
          !(disable24hMode && (tab.builtin === '24h' || tab.builtin === 'pulse'))
      ),
    [feedTabs, disable24hMode]
  )

  const [selectedTabId, setSelectedTabId] = useState<string | undefined>()
  const selectedTab: TFeedTabConfig = selectedTabId
    ? (visibleTabs.find((tab) => tab.id === selectedTabId) ?? visibleTabs[0])
    : visibleTabs[0]

  useEffect(() => {
    if (selectedTab && selectedTab.id !== selectedTabId) {
      setSelectedTabId(selectedTab.id)
    }
  }, [selectedTab, selectedTabId])

  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)
  const userAggregationListRef = useRef<TUserAggregationListRef>(null)
  const deepPulseListRef = useRef<TDeepPulseListRef>(null)
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
  const isPulseMode = selectedTab?.builtin === 'pulse'
  const effectiveShowKinds = selectedTab?.kinds ?? temporaryShowKinds
  const hideReplies = selectedTab?.hideReplies ?? false

  useEffect(() => {
    setTemporaryShowKinds(feedShowKinds)
  }, [feedShowKinds])

  const handleListModeChange = (mode: string) => {
    setSelectedTabId(mode)
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
                  } else if (isPulseMode) {
                    deepPulseListRef.current?.refresh()
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
      <div ref={topRef} className="scroll-mt-24.25" />
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
        ) : isPulseMode ? (
          <DeepPulseList
            ref={deepPulseListRef}
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

import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import TrustScoreFilter from '@/components/TrustScoreFilter'
import UserAggregationList, { TUserAggregationListRef } from '@/components/UserAggregationList'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest, TNoteListMode } from '@/types'
import { Event } from 'nostr-tools'
import { ReactNode, useMemo, useRef, useState } from 'react'
import KindFilter from '../KindFilter'
import { RefreshButton } from '../RefreshButton'

export default function NormalFeed({
  trustScoreFilterId,
  subRequests,
  areAlgoRelays = false,
  isMainFeed = false,
  showRelayCloseReason = false,
  disable24hMode = false,
  onRefresh,
  isPubkeyFeed = false,
  noteFilterFn,
  extraOptions
}: {
  trustScoreFilterId?: string
  subRequests: TFeedSubRequest[]
  areAlgoRelays?: boolean
  isMainFeed?: boolean
  showRelayCloseReason?: boolean
  disable24hMode?: boolean
  onRefresh?: () => void
  isPubkeyFeed?: boolean
  noteFilterFn?: (event: Event) => boolean
  extraOptions?: ReactNode
}) {
  const { showKinds } = useKindFilter()
  const { getMinTrustScore } = useUserTrust()
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)
  const userAggregationListRef = useRef<TUserAggregationListRef>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const showKindsFilter = useMemo(() => {
    return subRequests.every((req) => !req.filter.kinds?.length)
  }, [subRequests])
  const [trustFilterOpen, setTrustFilterOpen] = useState(false)
  const trustScoreThreshold = useMemo(() => {
    return trustScoreFilterId ? getMinTrustScore(trustScoreFilterId) : undefined
  }, [trustScoreFilterId, getMinTrustScore])

  const handleListModeChange = (mode: TNoteListMode) => {
    setListMode(mode)
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
        value={listMode === '24h' && disable24hMode ? 'posts' : listMode}
        tabs={[
          { value: 'posts', label: 'Notes' },
          { value: 'postsAndReplies', label: 'Replies' },
          ...(!disable24hMode ? [{ value: '24h', label: '24h Pulse' }] : [])
        ]}
        onTabChange={(listMode) => {
          handleListModeChange(listMode as TNoteListMode)
        }}
        options={
          <>
            {!supportTouch && (
              <RefreshButton
                onClick={() => {
                  if (onRefresh) {
                    onRefresh()
                    return
                  }
                  if (listMode === '24h') {
                    userAggregationListRef.current?.refresh()
                  } else {
                    noteListRef.current?.refresh()
                  }
                }}
              />
            )}
            {trustScoreFilterId && (
              <TrustScoreFilter
                filterId={trustScoreFilterId}
                onOpenChange={handleTrustFilterOpenChange}
              />
            )}
            {showKindsFilter && (
              <KindFilter
                showKinds={temporaryShowKinds}
                onShowKindsChange={handleShowKindsChange}
              />
            )}
            {extraOptions}
          </>
        }
        active={trustFilterOpen}
      />
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
      {listMode === '24h' && !disable24hMode ? (
        <UserAggregationList
          ref={userAggregationListRef}
          showKinds={temporaryShowKinds}
          subRequests={subRequests}
          areAlgoRelays={areAlgoRelays}
          showRelayCloseReason={showRelayCloseReason}
          isPubkeyFeed={isPubkeyFeed}
          trustScoreThreshold={trustScoreThreshold}
          filterFn={noteFilterFn}
        />
      ) : (
        <NoteList
          ref={noteListRef}
          showKinds={temporaryShowKinds}
          subRequests={subRequests}
          hideReplies={listMode === 'posts'}
          areAlgoRelays={areAlgoRelays}
          showRelayCloseReason={showRelayCloseReason}
          isPubkeyFeed={isPubkeyFeed}
          trustScoreThreshold={trustScoreThreshold}
          filterFn={noteFilterFn}
        />
      )}
    </>
  )
}

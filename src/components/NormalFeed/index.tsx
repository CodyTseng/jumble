import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import UserAggregationList, { TUserAggregationListRef } from '@/components/UserAggregationList'
import { ExtendedKind } from '@/constants'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { VideoFeedProvider } from '@/providers/VideoFeedProvider'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest, TNoteListMode } from '@/types'
import { Event } from 'nostr-tools'
import { useMemo, useRef, useState } from 'react'
import KindFilter from '../KindFilter'
import { RefreshButton } from '../RefreshButton'

// Video kinds for the Videos tab
const VIDEO_KINDS = [
  ExtendedKind.VIDEO,
  ExtendedKind.SHORT_VIDEO,
  ExtendedKind.ADDRESSABLE_NORMAL_VIDEO,
  ExtendedKind.ADDRESSABLE_SHORT_VIDEO
]

export default function NormalFeed({
  subRequests,
  areAlgoRelays = false,
  isMainFeed = false,
  showRelayCloseReason = false,
  filterFn,
  disable24hMode = false
}: {
  subRequests: TFeedSubRequest[]
  areAlgoRelays?: boolean
  isMainFeed?: boolean
  showRelayCloseReason?: boolean
  filterFn?: (event: Event) => boolean
  disable24hMode?: boolean
}) {
  const { hideUntrustedNotes } = useUserTrust()
  const { showKinds } = useKindFilter()
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)
  const userAggregationListRef = useRef<TUserAggregationListRef>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const showKindsFilter = useMemo(() => {
    return subRequests.every((req) => !req.filter.kinds?.length)
  }, [subRequests])

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

  return (
    <>
      <Tabs
        value={listMode === '24h' && disable24hMode ? 'posts' : listMode}
        tabs={[
          { value: 'posts', label: 'Notes' },
          { value: 'postsAndReplies', label: 'Replies' },
          { value: 'videos', label: 'Videos' },
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
                  if (listMode === '24h') {
                    userAggregationListRef.current?.refresh()
                  } else {
                    noteListRef.current?.refresh()
                  }
                }}
              />
            )}
            {showKindsFilter && listMode !== 'videos' && (
              <KindFilter
                showKinds={temporaryShowKinds}
                onShowKindsChange={handleShowKindsChange}
              />
            )}
          </>
        }
      />
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
      {listMode === '24h' && !disable24hMode ? (
        <UserAggregationList
          ref={userAggregationListRef}
          showKinds={temporaryShowKinds}
          subRequests={subRequests}
          filterFn={filterFn}
        />
      ) : (
        <VideoFeedProvider isVideoFeed={listMode === 'videos'}>
          <NoteList
            ref={noteListRef}
            showKinds={listMode === 'videos' ? VIDEO_KINDS : temporaryShowKinds}
            subRequests={subRequests}
            hideReplies={listMode === 'posts'}
            hideUntrustedNotes={hideUntrustedNotes}
            areAlgoRelays={areAlgoRelays}
            showRelayCloseReason={showRelayCloseReason}
          />
        </VideoFeedProvider>
      )}
    </>
  )
}

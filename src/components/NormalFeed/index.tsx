import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { useUserTrust } from '@/providers/UserTrustProvider'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest, TNoteListMode } from '@/types'
import { useRef, useState } from 'react'

export default function NormalFeed({
  subRequests,
  areAlgoRelays = false,
  isMainFeed = false
}: {
  subRequests: TFeedSubRequest[]
  areAlgoRelays?: boolean
  isMainFeed?: boolean
}) {
  const { hideUntrustedNotes } = useUserTrust()
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const noteListRef = useRef<TNoteListRef>(null)

  const handleListModeChange = (mode: TNoteListMode) => {
    setListMode(mode)
    if (isMainFeed) {
      storage.setNoteListMode(mode)
    }
    setTimeout(() => {
      noteListRef.current?.scrollToTop()
    }, 0)
  }

  return (
    <>
      <Tabs
        value={listMode}
        tabs={[
          { value: 'posts', label: 'Notes' },
          { value: 'postsAndReplies', label: 'Replies' }
        ]}
        onTabChange={(listMode) => {
          handleListModeChange(listMode as TNoteListMode)
        }}
      />
      <NoteList
        ref={noteListRef}
        subRequests={subRequests}
        hideReplies={listMode === 'posts'}
        hideUntrustedNotes={hideUntrustedNotes}
        areAlgoRelays={areAlgoRelays}
      />
    </>
  )
}

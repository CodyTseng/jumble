import { Separator } from '@/components/ui/separator'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import Note from '../Note'
import RepostDescription from './RepostDescription'
import { getParentEventId, getRootEventId } from '@/lib/event.ts'
import { useFetchEvent } from '@/hooks'
import { useMemo } from 'react'
import { useMuteList } from '@/providers/MuteListProvider.tsx'
import { NoteCardLoadingSkeleton } from '@/components/NoteCard/index.tsx'
import { useFeed } from '@/providers/FeedProvider.tsx'

export default function MainNoteCard({
  event,
  className,
  reposter,
  embedded
}: {
  event: Event
  className?: string
  reposter?: string
  embedded?: boolean
}) {
  const { push } = useSecondaryPage()

  const { hideMutedUserNoteRepliesInFeed } = useFeed()

  const { mutePubkeys } = useMuteList()
  const { event: parentEvent, isFetching: isFetchingParentEvent } = useFetchEvent(
    getParentEventId(event)
  )
  const { event: rootEvent, isFetching: isFetchingRootEvent } = useFetchEvent(getRootEventId(event))
  const isMuted = useMemo(
    () =>
      Boolean(
        (parentEvent && mutePubkeys.includes(parentEvent.pubkey)) ||
          (rootEvent && mutePubkeys.includes(rootEvent.pubkey))
      ),
    [mutePubkeys, parentEvent, rootEvent]
  )

  if (hideMutedUserNoteRepliesInFeed) {
    if (isFetchingParentEvent || isFetchingRootEvent)
      return <NoteCardLoadingSkeleton isPictures={false} />
    if (isMuted) return null
  }

  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(event))
      }}
    >
      <div
        className={`clickable text-left ${embedded ? 'p-2 sm:p-3 border rounded-lg' : 'px-4 py-3'}`}
      >
        <RepostDescription reposter={reposter} />
        <Note
          size={embedded ? 'small' : 'normal'}
          event={event}
          hideStats={embedded}
          parentEvent={parentEvent}
          isFetchingParentEvent={isFetchingParentEvent}
        />
      </div>
      {!embedded && <Separator />}
    </div>
  )
}

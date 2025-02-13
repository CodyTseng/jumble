import { Separator } from '@/components/ui/separator'
import { GROUP_METADATA_EVENT_KIND } from '@/constants'
import { useFetchEvent } from '@/hooks'
import { getParentEventId, getRootEventId, isSupportedKind } from '@/lib/event'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import Note from '../Note'
import GroupMetadataCard from './GroupMetadataCard'
import LiveEventCard from './LiveEventCard'
import LongFormArticleCard from './LongFormArticleCard'
import RepostDescription from './RepostDescription'
import UnknownNoteCard from './UnknownNoteCard'

export default function NormalNoteCard({
  event,
  className,
  reposter,
  embedded,
  originalNoteId
}: {
  event: Event
  className?: string
  reposter?: string
  embedded?: boolean
  originalNoteId?: string
}) {
  const { push } = useSecondaryPage()
  const { event: rootEvent } = useFetchEvent(getRootEventId(event))
  const { event: parentEvent } = useFetchEvent(getParentEventId(event))
  const supported = useMemo(() => isSupportedKind(event.kind), [event])

  if (supported) {
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
            parentEvent={parentEvent ?? rootEvent}
            hideStats={embedded}
          />
        </div>
        {!embedded && <Separator />}
      </div>
    )
  }
  if (event.kind === kinds.LongFormArticle) {
    return <LongFormArticleCard className={className} event={event} embedded={embedded} />
  }
  if (event.kind === kinds.LiveEvent) {
    return <LiveEventCard className={className} event={event} embedded={embedded} />
  }
  if (event.kind === GROUP_METADATA_EVENT_KIND) {
    return (
      <GroupMetadataCard
        className={className}
        event={event}
        originalNoteId={originalNoteId}
        embedded={embedded}
      />
    )
  }
  return <UnknownNoteCard className={className} event={event} embedded={embedded} />
}

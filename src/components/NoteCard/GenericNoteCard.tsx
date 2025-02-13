import { GROUP_METADATA_EVENT_KIND } from '@/constants'
import { isSupportedKind } from '@/lib/event'
import { Event, kinds } from 'nostr-tools'
import GroupMetadataCard from './GroupMetadataCard'
import LiveEventCard from './LiveEventCard'
import LongFormArticleCard from './LongFormArticleCard'
import MainNoteCard from './MainNoteCard'
import UnknownNoteCard from './UnknownNoteCard'

export default function GenericNoteCard({
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
  if (isSupportedKind(event.kind)) {
    return (
      <MainNoteCard event={event} className={className} reposter={reposter} embedded={embedded} />
    )
  }
  if (event.kind === kinds.LongFormArticle) {
    return (
      <LongFormArticleCard
        className={className}
        reposter={reposter}
        event={event}
        embedded={embedded}
      />
    )
  }
  if (event.kind === kinds.LiveEvent) {
    return (
      <LiveEventCard event={event} className={className} reposter={reposter} embedded={embedded} />
    )
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
  return (
    <UnknownNoteCard event={event} className={className} reposter={reposter} embedded={embedded} />
  )
}

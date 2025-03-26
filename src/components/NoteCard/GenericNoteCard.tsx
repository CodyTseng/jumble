import { ExtendedKind } from '@/constants'
import { isSupportedKind } from '@/lib/event'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { useState } from 'react'
import GroupMetadataCard from './GroupMetadataCard'
import LiveEventCard from './LiveEventCard'
import LongFormArticleCard from './LongFormArticleCard'
import MainNoteCard from './MainNoteCard'
import MutedNoteCard from './MutedNoteCard'
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
  const [showMuted, setShowMuted] = useState(false)
  const { mutePubkeys } = useMuteList()

  if (mutePubkeys.includes(event.pubkey) && !showMuted) {
    return (
      <MutedNoteCard
        event={event}
        className={className}
        reposter={reposter}
        embedded={embedded}
        show={() => setShowMuted(true)}
      />
    )
  }

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
  if (event.kind === ExtendedKind.GROUP_METADATA) {
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

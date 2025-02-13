import { useSecondaryPage } from '@/PageManager'
import { GROUP_METADATA_EVENT_KIND } from '@/constants'
import { getUsingClient, isSupportedKind } from '@/lib/event'
import { toNote } from '@/lib/link'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import NoteStats from '../NoteStats'
import ParentNotePreview from '../ParentNotePreview'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import GroupMetadataNote from './GroupMetadataNote'
import LiveEventNote from './LiveEventNote'
import LongFormArticleNote from './LongFormArticleNote'
import UnknownKindNote from './UnknownKindNote'

export default function Note({
  event,
  parentEvent,
  size = 'normal',
  className,
  hideStats = false,
  fetchNoteStats = false,
  originalNoteId
}: {
  event: Event
  parentEvent?: Event
  size?: 'normal' | 'small'
  className?: string
  hideStats?: boolean
  fetchNoteStats?: boolean
  originalNoteId?: string
}) {
  const { push } = useSecondaryPage()
  const usingClient = useMemo(() => getUsingClient(event), [event])
  const supported = useMemo(() => isSupportedKind(event.kind), [event])

  let content = <UnknownKindNote className="mt-2" event={event} />
  if (supported) {
    content = <Content className="mt-2" event={event} />
  } else if (event.kind === kinds.LongFormArticle) {
    content = <LongFormArticleNote className="mt-2" event={event} />
  } else if (event.kind === kinds.LiveEvent) {
    content = <LiveEventNote className="mt-2" event={event} />
  } else if (event.kind === GROUP_METADATA_EVENT_KIND) {
    content = <GroupMetadataNote className="mt-2" event={event} originalNoteId={originalNoteId} />
  }

  return (
    <div className={className}>
      <div className="flex items-center space-x-2">
        <UserAvatar userId={event.pubkey} size={size === 'small' ? 'small' : 'normal'} />
        <div
          className={`flex-1 w-0 ${size === 'small' ? 'flex space-x-2 items-center overflow-hidden' : ''}`}
        >
          <div className="flex gap-2 items-center">
            <Username
              userId={event.pubkey}
              className={`font-semibold flex ${size === 'small' ? 'text-sm' : ''}`}
              skeletonClassName={size === 'small' ? 'h-3' : 'h-4'}
            />
            {usingClient && size === 'normal' && (
              <div className="text-xs text-muted-foreground truncate">using {usingClient}</div>
            )}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-1">
            <FormattedTimestamp timestamp={event.created_at} />
          </div>
        </div>
      </div>
      {parentEvent && (
        <ParentNotePreview
          event={parentEvent}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(parentEvent))
          }}
        />
      )}
      {content}
      {!hideStats && (
        <NoteStats className="mt-3" event={event} fetchIfNotExisting={fetchNoteStats} />
      )}
    </div>
  )
}

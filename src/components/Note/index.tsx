import { useSecondaryPage } from '@/PageManager'
import { useFetchEvent } from '@/hooks'
import { getParentEventId, getUsingClient } from '@/lib/event'
import { toNote } from '@/lib/link'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import NoteOptions from '../NoteOptions'
import NoteStats from '../NoteStats'
import ParentNotePreview from '../ParentNotePreview'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function Note({
  event,
  size = 'normal',
  className,
  hideParentNotePreview = false,
  hideStats = false,
  fetchNoteStats = false
}: {
  event: Event
  size?: 'normal' | 'small'
  className?: string
  hideParentNotePreview?: boolean
  hideStats?: boolean
  fetchNoteStats?: boolean
}) {
  const { push } = useSecondaryPage()
  const parentEventId = useMemo(
    () => (hideParentNotePreview ? undefined : getParentEventId(event)),
    [event, hideParentNotePreview]
  )
  const { event: parentEvent, isFetching } = useFetchEvent(parentEventId)
  const usingClient = useMemo(() => getUsingClient(event), [event])

  return (
    <div className={className}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <UserAvatar userId={event.pubkey} size={size === 'small' ? 'small' : 'normal'} />
          <div
            className={`flex-1 w-0 ${size === 'small' ? 'flex space-x-2 items-center overflow-hidden' : ''}`}
          >
            <div className="flex gap-2 items-center">
              <Username
                userId={event.pubkey}
                className={`font-semibold flex truncate ${size === 'small' ? 'text-sm' : ''}`}
                skeletonClassName={size === 'small' ? 'h-3' : 'h-4'}
              />
              {usingClient && size === 'normal' && (
                <div className="text-xs text-muted-foreground shrink-0">using {usingClient}</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground shrink-0">
              <FormattedTimestamp timestamp={event.created_at} />
            </div>
          </div>
        </div>
        {size === 'normal' && <NoteOptions event={event} className="shrink-0 [&_svg]:size-5" />}
      </div>
      {parentEventId && (
        <ParentNotePreview
          event={parentEvent}
          isFetching={isFetching}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(parentEventId))
          }}
        />
      )}
      <Content className="mt-2" event={event} />
      {!hideStats && (
        <NoteStats className="mt-3" event={event} fetchIfNotExisting={fetchNoteStats} />
      )}
    </div>
  )
}

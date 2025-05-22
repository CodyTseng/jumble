import { useSecondaryPage } from '@/PageManager'
import {
  extractImageInfosFromEventTags,
  getParentEventId,
  getUsingClient,
  isPictureEvent
} from '@/lib/event'
import { toNote } from '@/lib/link'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import ImageGallery from '../ImageGallery'
import NoteOptions from '../NoteOptions'
import ParentNotePreview from '../ParentNotePreview'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import Highlight from './Highlight'

export default function Note({
  event,
  size = 'normal',
  className,
  hideParentNotePreview = false
}: {
  event: Event
  size?: 'normal' | 'small'
  className?: string
  hideParentNotePreview?: boolean
}) {
  const { push } = useSecondaryPage()
  const parentEventId = useMemo(
    () =>
      !hideParentNotePreview && event.kind === kinds.ShortTextNote
        ? getParentEventId(event)
        : undefined,
    [event, hideParentNotePreview]
  )
  const imageInfos = useMemo(
    () => (isPictureEvent(event) ? extractImageInfosFromEventTags(event) : []),
    [event]
  )
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
          eventId={parentEventId}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(parentEventId))
          }}
        />
      )}
      {event.kind === kinds.Highlights ? (
        <Highlight className="mt-2" event={event} />
      ) : (
        <Content className="mt-2" event={event} />
      )}
      {imageInfos.length > 0 && <ImageGallery images={imageInfos} />}
    </div>
  )
}

import { useSecondaryPage } from '@renderer/PageManager'
import { toNote } from '@renderer/lib/link'
import { formatTimestamp } from '@renderer/lib/timestamp'
import { Event } from 'nostr-tools'
import Content from '../Content'
import NoteStats from '../NoteStats'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import ParentNotePreview from '../ParentNotePreview'

export default function Note({
  event,
  parentEvent,
  size = 'normal',
  className,
  hideStats = false,
  fetchNoteStats = false
}: {
  event: Event
  parentEvent?: Event
  size?: 'normal' | 'small'
  className?: string
  hideStats?: boolean
  fetchNoteStats?: boolean
}) {
  const { push } = useSecondaryPage()

  return (
    <div className={className}>
      <div className="flex items-center space-x-2">
        <UserAvatar userId={event.pubkey} size={size === 'small' ? 'small' : 'normal'} />
        <div
          className={`flex-1 w-0 ${size === 'small' ? 'flex space-x-2 items-end overflow-hidden' : ''}`}
        >
          <Username
            userId={event.pubkey}
            className={`font-semibold flex ${size === 'small' ? 'text-sm' : ''}`}
          />
          <div className="text-xs text-muted-foreground line-clamp-1">
            {formatTimestamp(event.created_at)}
          </div>
        </div>
      </div>
      {parentEvent && (
        <ParentNotePreview
          event={parentEvent}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(parentEvent.id))
          }}
        />
      )}
      <Content className="mt-2" event={event} />
      {!hideStats && (
        <NoteStats className="mt-4" event={event} fetchIfNotExisting={fetchNoteStats} />
      )}
    </div>
  )
}

import { getUsingClient } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { FormattedTimestamp } from '../FormattedTimestamp'
import NoteStats from '../NoteStats'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import PictureContent from '../PictureContent'
import NoteOptions from '../NoteOptions'

export default function PictureNote({
  event,
  className,
  hideStats = false,
  fetchNoteStats = false
}: {
  event: Event
  className?: string
  hideStats?: boolean
  fetchNoteStats?: boolean
}) {
  const usingClient = useMemo(() => getUsingClient(event), [event])

  return (
    <div className={className}>
      <div className="px-4 flex justify-between items-start gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <UserAvatar userId={event.pubkey} />
          <div className="flex-1 w-0">
            <div className="flex gap-2 items-center">
              <Username
                userId={event.pubkey}
                className="font-semibold flex truncate"
                skeletonClassName="h-4"
              />
              {usingClient && (
                <div className="text-xs text-muted-foreground truncate">using {usingClient}</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-1">
              <FormattedTimestamp timestamp={event.created_at} />
            </div>
          </div>
        </div>
        <NoteOptions event={event} className="shrink-0 [&_svg]:size-5" />
      </div>
      <PictureContent className="mt-2" event={event} />
      {!hideStats && (
        <NoteStats
          className="px-4 mt-3 sm:mt-4"
          event={event}
          fetchIfNotExisting={fetchNoteStats}
        />
      )}
    </div>
  )
}

import { getGroupMetadataFromEvent } from '@/lib/event-metadata'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import ClientSelect from '../ClientSelect'
import Image from '../Image'

export default function GroupMetadata({
  event,
  originalNoteId,
  className
}: {
  event: Event
  originalNoteId?: string
  className?: string
}) {
  const metadata = useMemo(() => getGroupMetadataFromEvent(event), [event])

  const groupNameComponent = (
    <div className="text-xl font-semibold line-clamp-1">{metadata.name}</div>
  )

  const groupAboutComponent = metadata.about && (
    <div className="text-sm text-muted-foreground line-clamp-2">{metadata.about}</div>
  )

  return (
    <div className={className}>
      <div className="flex gap-4">
        {metadata.picture && (
          <Image
            image={{ url: metadata.picture, pubkey: event.pubkey }}
            className="rounded-lg aspect-square object-cover bg-foreground h-20"
            hideIfError
          />
        )}
        <div className="flex-1 w-0 space-y-1">
          {groupNameComponent}
          {groupAboutComponent}
        </div>
      </div>
      <ClientSelect className="w-full mt-2" event={event} originalNoteId={originalNoteId} />
    </div>
  )
}

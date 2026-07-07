import { getGroupMetadataFromEvent } from '@/lib/event-metadata'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
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
  const { autoLoadMedia } = useContentPolicy()
  const metadata = useMemo(() => getGroupMetadataFromEvent(event), [event])

  const groupNameComponent = (
    <div dir="auto" className="line-clamp-1 text-xl font-semibold">
      {metadata.name}
    </div>
  )

  const groupAboutComponent = metadata.about && (
    <div dir="auto" className="line-clamp-2 text-sm text-muted-foreground">
      {metadata.about}
    </div>
  )

  return (
    <div className={className}>
      <div className="flex gap-4">
        {metadata.picture && autoLoadMedia && (
          <Image
            image={{ url: metadata.picture, pubkey: event.pubkey }}
            className="aspect-square h-20 bg-foreground"
            hideIfError
          />
        )}
        <div className="w-0 flex-1 space-y-1">
          {groupNameComponent}
          {groupAboutComponent}
        </div>
      </div>
      <ClientSelect className="mt-2 w-full" event={event} originalNoteId={originalNoteId} />
    </div>
  )
}

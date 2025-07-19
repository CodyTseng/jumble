import { getCommunityDefinitionFromEvent } from '@/lib/event-metadata'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import ClientSelect from '../ClientSelect'
import Image from '../Image'

export default function CommunityDefinition({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const metadata = useMemo(() => getCommunityDefinitionFromEvent(event), [event])

  const communityNameComponent = (
    <div className="text-xl font-semibold line-clamp-1">{metadata.name}</div>
  )

  const communityDescriptionComponent = metadata.description && (
    <div className="text-sm text-muted-foreground line-clamp-2">{metadata.description}</div>
  )

  return (
    <div className={className}>
      <div className="flex gap-4">
        {metadata.image && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="rounded-lg aspect-square object-cover bg-foreground h-20"
            hideIfError
          />
        )}
        <div className="flex-1 w-0 space-y-1">
          {communityNameComponent}
          {communityDescriptionComponent}
        </div>
      </div>
      <ClientSelect className="w-full mt-2" event={event} />
    </div>
  )
}

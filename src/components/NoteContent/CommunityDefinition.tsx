import { getCommunityDefinitionFromEvent } from '@/lib/event-metadata'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
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
  const { autoLoadMedia } = useContentPolicy()
  const metadata = useMemo(() => getCommunityDefinitionFromEvent(event), [event])

  const communityNameComponent = (
    <div dir="auto" className="line-clamp-1 text-xl font-semibold">
      {metadata.name}
    </div>
  )

  const communityDescriptionComponent = metadata.description && (
    <div dir="auto" className="line-clamp-2 text-sm text-muted-foreground">
      {metadata.description}
    </div>
  )

  return (
    <div className={className}>
      <div className="flex gap-4">
        {metadata.image && autoLoadMedia && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="aspect-square h-20 bg-foreground"
            hideIfError
          />
        )}
        <div className="w-0 flex-1 space-y-1">
          {communityNameComponent}
          {communityDescriptionComponent}
        </div>
      </div>
      <ClientSelect className="mt-2 w-full" event={event} />
    </div>
  )
}

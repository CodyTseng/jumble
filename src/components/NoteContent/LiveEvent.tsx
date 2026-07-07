import { Badge } from '@/components/ui/badge'
import { getLiveEventMetadataFromEvent } from '@/lib/event-metadata'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import ClientSelect from '../ClientSelect'
import Image from '../Image'

export default function LiveEvent({ event, className }: { event: Event; className?: string }) {
  const { isSmallScreen } = useScreenSize()

  const { autoLoadMedia } = useContentPolicy()
  const metadata = useMemo(() => getLiveEventMetadataFromEvent(event), [event])

  const liveStatusComponent =
    metadata.status &&
    (metadata.status === 'live' ? (
      <Badge className="bg-green-400 hover:bg-green-400">live</Badge>
    ) : metadata.status === 'ended' ? (
      <Badge variant="destructive">ended</Badge>
    ) : (
      <Badge variant="secondary">{metadata.status}</Badge>
    ))

  const titleComponent = <div className="line-clamp-1 text-xl font-semibold">{metadata.title}</div>

  const summaryComponent = metadata.summary && (
    <div className="line-clamp-4 text-sm text-muted-foreground">{metadata.summary}</div>
  )

  const tagsComponent = metadata.tags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {metadata.tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )

  if (isSmallScreen) {
    return (
      <div className={className}>
        {metadata.image && autoLoadMedia && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="aspect-video w-full"
            hideIfError
          />
        )}
        <div className="space-y-1">
          {titleComponent}
          {liveStatusComponent}
          {summaryComponent}
          {tagsComponent}
          <ClientSelect className="mt-2 w-full" event={event} />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-4">
        {metadata.image && autoLoadMedia && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="aspect-4/3 h-44 bg-foreground xl:aspect-video"
            hideIfError
          />
        )}
        <div className="w-0 flex-1 space-y-1">
          {titleComponent}
          {liveStatusComponent}
          {summaryComponent}
          {tagsComponent}
        </div>
      </div>
      <ClientSelect className="mt-2 w-full" event={event} />
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import ClientSelect from '../ClientSelect'
import Image from '../Image'

export default function LongFormArticle({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const metadata = useMemo(() => getLongFormArticleMetadataFromEvent(event), [event])

  const titleComponent = <div className="text-xl font-semibold line-clamp-2">{metadata.title}</div>

  const tagsComponent = metadata.tags.length > 0 && (
    <div className="flex gap-1 flex-wrap">
      {metadata.tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )

  const summaryComponent = metadata.summary && (
    <div className="text-sm text-muted-foreground line-clamp-4">{metadata.summary}</div>
  )

  if (isSmallScreen) {
    return (
      <div className={className}>
        {metadata.image && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="w-full aspect-video object-cover rounded-lg"
            hideIfError
          />
        )}
        <div className="space-y-1">
          {titleComponent}
          {summaryComponent}
          {tagsComponent}
          <ClientSelect className="w-full mt-2" event={event} />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-4">
        {metadata.image && (
          <Image
            image={{ url: metadata.image, pubkey: event.pubkey }}
            className="rounded-lg aspect-[4/3] xl:aspect-video object-cover bg-foreground h-44"
            hideIfError
          />
        )}
        <div className="flex-1 w-0 space-y-1">
          {titleComponent}
          {summaryComponent}
          {tagsComponent}
        </div>
      </div>
      <ClientSelect className="w-full mt-2" event={event} />
    </div>
  )
}

import { ExtendedKind } from '@/constants'
import { getImetaInfosFromEvent } from '@/lib/event'
import { getVideoMetadataFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import { CONTENT_LAYOUT_CLASS_NAME } from '../Content/node-layout'
import { EmbeddedHashtag } from '../Embedded'
import MediaPlayer from '../MediaPlayer'

export default function VideoNote({ event, className }: { event: Event; className?: string }) {
  const videoInfos = useMemo(() => getImetaInfosFromEvent(event), [event])
  const isAddressable =
    event.kind === ExtendedKind.ADDRESSABLE_NORMAL_VIDEO ||
    event.kind === ExtendedKind.ADDRESSABLE_SHORT_VIDEO
  const metadata = useMemo(
    () => (isAddressable ? getVideoMetadataFromEvent(event) : null),
    [event, isAddressable]
  )

  return (
    <div className={cn(CONTENT_LAYOUT_CLASS_NAME, className)}>
      {metadata?.title && (
        <div dir="auto" className="font-semibold">
          {metadata.title}
        </div>
      )}
      <Content event={event} />
      {metadata && metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {metadata.tags.map((tag) => (
            <EmbeddedHashtag key={tag} hashtag={tag} />
          ))}
        </div>
      )}
      {videoInfos.map((video) => (
        <MediaPlayer src={video.url} pubkey={video.pubkey} key={video.url} dim={video.dim} />
      ))}
    </div>
  )
}

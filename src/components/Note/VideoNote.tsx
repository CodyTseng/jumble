import { getImetaInfosFromEvent } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import MediaPlayer from '../MediaPlayer'

export default function VideoNote({ event, className, compactMedia = false }: { event: Event; className?: string; compactMedia?: boolean }) {
  const videoInfos = useMemo(() => getImetaInfosFromEvent(event), [event])
  const isSingleVideo = videoInfos.length === 1

  return (
    <div className={className}>
      <Content event={event} compactMedia={compactMedia} />
      {videoInfos.map((video) => (
        <MediaPlayer
          src={video.url}
          key={video.url}
          className="mt-2"
          compactMedia={compactMedia}
          isSingleMedia={isSingleVideo}
        />
      ))}
    </div>
  )
}

import { ExtendedKind } from '@/constants'
import { getImetaInfosFromEvent } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import MediaPlayer from '../MediaPlayer'

// Video kinds that should loop (short-form videos like Vine/TikTok style)
const LOOPING_VIDEO_KINDS = [
  ExtendedKind.SHORT_VIDEO, // kind 22
  ExtendedKind.ADDRESSABLE_SHORT_VIDEO // kind 34236 (Divine videos)
]

export default function VideoNote({ event, className }: { event: Event; className?: string }) {
  const videoInfos = useMemo(() => getImetaInfosFromEvent(event), [event])
  const shouldLoop = LOOPING_VIDEO_KINDS.includes(event.kind)

  return (
    <div className={className}>
      <Content event={event} />
      {videoInfos.map((video) => (
        <MediaPlayer src={video.url} key={video.url} className="mt-2" loop={shouldLoop} />
      ))}
    </div>
  )
}

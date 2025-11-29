import { ExtendedKind } from '@/constants'
import { getImetaInfosFromEvent } from '@/lib/event'
import { DIVINE_VIDEO_KIND, parseVideoEvents } from '@/lib/divine-video'
import { useVideoFeed } from '@/providers/VideoFeedProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import MediaPlayer from '../MediaPlayer'

// Video kinds that should loop (short-form videos like Vine/TikTok style)
const LOOPING_VIDEO_KINDS = [
  ExtendedKind.SHORT_VIDEO, // kind 22
  ExtendedKind.ADDRESSABLE_SHORT_VIDEO // kind 34236 (Divine videos)
]

export default function VideoNote({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { isVideoFeed } = useVideoFeed()
  const shouldLoop = LOOPING_VIDEO_KINDS.includes(event.kind)

  // Get video URLs - use divine-video parser for Divine videos, standard parser for others
  const videoUrls = useMemo(() => {
    // For Divine videos (kind 34236), use the specialized parser
    if (event.kind === DIVINE_VIDEO_KIND) {
      const parsed = parseVideoEvents([event])
      if (parsed.length > 0 && parsed[0].videoUrl) {
        // Collect main URL and fallback URLs
        const urls = [parsed[0].videoUrl]
        if (parsed[0].fallbackVideoUrls) {
          urls.push(...parsed[0].fallbackVideoUrls)
        }
        return urls
      }
    }

    // Fall back to standard imeta parsing
    const imetaInfos = getImetaInfosFromEvent(event)
    return imetaInfos.map(info => info.url)
  }, [event])

  // Unmute videos by default when viewing the video feed
  const defaultMuted = isVideoFeed ? false : undefined

  return (
    <div className={className}>
      <Content event={event} />
      {videoUrls.map((url) => (
        <MediaPlayer
          src={url}
          key={url}
          className="mt-2"
          loop={shouldLoop}
          defaultMuted={defaultMuted}
        />
      ))}
    </div>
  )
}

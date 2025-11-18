import { useStuff } from '@/hooks/useStuff'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import stuffStatsService from '@/services/stuff-stats.service'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import BookmarkButton from '../BookmarkButton'
import LikeButton from './LikeButton'
import Likes from './Likes'
import ReplyButton from './ReplyButton'
import RepostButton from './RepostButton'
import SeenOnButton from './SeenOnButton'
import TopZaps from './TopZaps'
import ZapButton from './ZapButton'

export default function StuffStats({
  stuff,
  className,
  classNames,
  fetchIfNotExisting = false,
  displayTopZapsAndLikes = false
}: {
  stuff: Event | string
  className?: string
  classNames?: {
    buttonBar?: string
  }
  fetchIfNotExisting?: boolean
  displayTopZapsAndLikes?: boolean
}) {
  const { isSmallScreen } = useScreenSize()
  const { pubkey } = useNostr()
  const [loading, setLoading] = useState(false)
  const { event } = useStuff(stuff)

  useEffect(() => {
    if (!fetchIfNotExisting) return
    setLoading(true)
    stuffStatsService.fetchStuffStats(stuff, pubkey).finally(() => setLoading(false))
  }, [event, fetchIfNotExisting])

  if (isSmallScreen) {
    return (
      <div className={cn('select-none', className)}>
        {displayTopZapsAndLikes && (
          <>
            <TopZaps stuff={stuff} />
            <Likes stuff={stuff} />
          </>
        )}
        <div
          className={cn(
            'flex justify-between items-center h-5 [&_svg]:size-5',
            loading ? 'animate-pulse' : '',
            classNames?.buttonBar
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <ReplyButton stuff={stuff} />
          <RepostButton stuff={stuff} />
          <LikeButton stuff={stuff} />
          <ZapButton stuff={stuff} />
          <BookmarkButton stuff={stuff} />
          <SeenOnButton stuff={stuff} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('select-none', className)}>
      {displayTopZapsAndLikes && (
        <>
          <TopZaps stuff={stuff} />
          <Likes stuff={stuff} />
        </>
      )}
      <div className="flex justify-between h-5 [&_svg]:size-4">
        <div
          className={cn('flex items-center', loading ? 'animate-pulse' : '')}
          onClick={(e) => e.stopPropagation()}
        >
          <ReplyButton stuff={stuff} />
          <RepostButton stuff={stuff} />
          <LikeButton stuff={stuff} />
          <ZapButton stuff={stuff} />
        </div>
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <BookmarkButton stuff={stuff} />
          <SeenOnButton stuff={stuff} />
        </div>
      </div>
    </div>
  )
}

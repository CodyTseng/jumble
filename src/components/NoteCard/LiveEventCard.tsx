import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toZapStreamLiveEvent } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ExternalLink } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Image from '../Image'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import RepostDescription from './RepostDescription'

export default function LiveEventCard({
  event,
  className,
  embedded = false,
  reposter
}: {
  event: Event
  className?: string
  embedded?: boolean
  reposter?: string
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const metadata = useMemo(() => {
    let title: string | undefined
    let summary: string | undefined
    let image: string | undefined
    let status: string | undefined
    const tags = new Set<string>()

    event.tags.forEach(([tagName, tagValue]) => {
      if (tagName === 'title') {
        title = tagValue
      } else if (tagName === 'summary') {
        summary = tagValue
      } else if (tagName === 'image') {
        image = tagValue
      } else if (tagName === 'status') {
        status = tagValue
      } else if (tagName === 't' && tagValue && tags.size < 6) {
        tags.add(tagValue.toLocaleLowerCase())
      }
    })

    if (!title) {
      title = event.tags.find(tagNameEquals('d'))?.[1] ?? 'no title'
    }

    return { title, summary, image, status, tags: Array.from(tags) }
  }, [event])

  const liveStatusComponent =
    metadata.status &&
    (metadata.status === 'live' ? (
      <Badge className="bg-green-400 hover:bg-green-400">live</Badge>
    ) : metadata.status === 'ended' ? (
      <Badge variant="destructive">ended</Badge>
    ) : (
      <Badge variant="secondary">{metadata.status}</Badge>
    ))

  const userInfoComponent = (
    <div className="flex items-center space-x-2">
      <UserAvatar userId={event.pubkey} size={embedded ? 'small' : 'normal'} />
      <div
        className={`flex-1 w-0 ${embedded ? 'flex space-x-2 items-center overflow-hidden' : ''}`}
      >
        <div className="flex gap-2 items-center">
          <Username
            userId={event.pubkey}
            className={cn('font-semibold flex truncate', embedded ? 'text-sm' : '')}
            skeletonClassName={embedded ? 'h-3' : 'h-4'}
          />
          {liveStatusComponent}
        </div>
        <div className="text-xs text-muted-foreground line-clamp-1">
          <FormattedTimestamp timestamp={event.created_at} />
        </div>
      </div>
    </div>
  )

  const titleComponent = <div className="text-xl font-semibold line-clamp-1">{metadata.title}</div>

  const summaryComponent = metadata.summary && (
    <div className="text-sm text-muted-foreground line-clamp-4">{metadata.summary}</div>
  )

  const tagsComponent = metadata.tags.length > 0 && (
    <div className="flex gap-1 flex-wrap">
      {metadata.tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(toZapStreamLiveEvent(event), '_blank')
  }

  if (isSmallScreen) {
    return (
      <div className={className}>
        <div
          className={cn('flex flex-col gap-2', embedded ? 'p-2 border rounded-lg' : 'px-4 py-3')}
          onClick={handleClick}
        >
          <RepostDescription reposter={reposter} />
          {userInfoComponent}
          {metadata.image && (
            <Image
              image={{ url: metadata.image }}
              className="w-full aspect-video object-cover rounded-lg"
            />
          )}
          <div className="space-y-1">
            {titleComponent}
            {summaryComponent}
            {tagsComponent}
          </div>
        </div>
        {!embedded && <Separator />}
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn('flex gap-2 items-center', embedded ? 'p-3 border rounded-lg' : 'px-4 py-3')}
      >
        <div className="flex-1 w-0">
          <RepostDescription reposter={reposter} />
          {userInfoComponent}
          <div className="mt-2 space-y-1">
            {titleComponent}
            {summaryComponent}
            {tagsComponent}
          </div>
        </div>
        {metadata.image && (
          <Image image={{ url: metadata.image }} className="h-36 max-w-44 rounded-lg" />
        )}
      </div>
      {!embedded && <Separator />}
      <div
        className={cn(
          'absolute top-0 w-full h-full bg-muted/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer transition-opacity opacity-0 hover:opacity-100',
          embedded ? 'rounded-lg' : ''
        )}
        onClick={handleClick}
      >
        <div className="flex gap-2 items-center font-semibold">
          <ExternalLink className="size-4" /> {t('Open in a', { a: 'Zap Stream' })}
        </div>
      </div>
    </div>
  )
}

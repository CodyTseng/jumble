import { useFetchEvent } from '@/hooks'
import { createFakeEvent, isSupportedKind } from '@/lib/event'
import { toNjump, toNote } from '@/lib/link'
import { generateEventIdFromATag, generateEventIdFromETag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import ContentPreview from '../ContentPreview'
import UserAvatar from '../UserAvatar'

export default function Highlight({ event, className }: { event: Event; className?: string }) {
  const { comment, url, referenceEventId } = useMemo(() => {
    let comment: string | undefined
    let url: string | undefined
    let referenceEventId: string | undefined

    event.tags.forEach((tag) => {
      if (tag[0] === 'r') {
        url = tag[1]
      } else if (tag[0] === 'e') {
        const id = generateEventIdFromETag(tag)
        if (id) referenceEventId = id
      } else if (tag[0] === 'a') {
        const id = generateEventIdFromATag(tag)
        if (id) referenceEventId = id
      } else if (tag[0] === 'comment') {
        comment = tag[1]
      }
    })

    return { comment, url, referenceEventId }
  }, [event])

  return (
    <div className={cn('text-wrap break-words whitespace-pre-wrap space-y-4', className)}>
      {comment && <Content event={createFakeEvent({ content: comment })} />}
      <div className="flex gap-4">
        <div className="w-1 flex-shrink-0 my-1 bg-primary/60 rounded-md" />
        <div className="italic whitespace-pre-line">{event.content}</div>
      </div>

      <HighlightSource url={url} referenceEventId={referenceEventId} />
    </div>
  )
}

function HighlightSource({ url, referenceEventId }: { url?: string; referenceEventId?: string }) {
  const { push } = useSecondaryPage()
  const { event: referenceEvent } = useFetchEvent(referenceEventId)

  return url ? (
    <div className="truncate text-muted-foreground">
      {'From '}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-muted-foreground hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    </div>
  ) : referenceEventId ? (
    referenceEvent ? (
      <div className="flex items-center gap-2 text-muted-foreground">
        <div>{'From'}</div>
        <UserAvatar userId={referenceEvent.pubkey} size="xSmall" className="cursor-pointer" />
        {isSupportedKind(referenceEvent.kind) ? (
          <ContentPreview
            className="truncate underline pointer-events-auto cursor-pointer hover:text-foreground"
            event={referenceEvent}
            onClick={(e) => {
              e.stopPropagation()
              push(toNote(referenceEventId))
            }}
          />
        ) : (
          <div className="truncate text-muted-foreground">
            <a
              href={toNjump(referenceEventId)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {toNjump(referenceEventId)}
            </a>
          </div>
        )}
      </div>
    ) : (
      <div className="truncate text-muted-foreground">
        {'From '}
        <a
          href={toNjump(referenceEventId)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {toNjump(referenceEventId)}
        </a>
      </div>
    )
  ) : null
}

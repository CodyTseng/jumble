import { Separator } from '@/components/ui/separator'
import { useFetchEvent } from '@/hooks'
import { getUsingClient } from '@/lib/event'
import { toNjump, toNote } from '@/lib/link'
import { generateEventIdFromATag, generateEventIdFromETag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Collapsible from '../Collapsible'
import { FormattedTimestamp } from '../FormattedTimestamp'
import NoteOptions from '../NoteOptions'
import NoteStats from '../NoteStats'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import RepostDescription from './RepostDescription'

export default function HighlightCard({
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
  const { push } = useSecondaryPage()
  const usingClient = useMemo(() => getUsingClient(event), [event])

  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(event))
      }}
    >
      <div className={`clickable ${embedded ? 'p-2 sm:p-3 border rounded-lg' : 'py-3'}`}>
        <Collapsible alwaysExpand={embedded}>
          <RepostDescription className={embedded ? '' : 'px-4'} reposter={reposter} />
          <div className={embedded ? '' : 'px-4'}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center space-x-2 flex-1">
                <UserAvatar userId={event.pubkey} size={embedded ? 'small' : 'normal'} />
                <div
                  className={`flex-1 w-0 ${embedded ? 'flex space-x-2 items-center overflow-hidden' : ''}`}
                >
                  <div className="flex gap-2 items-center">
                    <Username
                      userId={event.pubkey}
                      className={`font-semibold flex truncate ${embedded ? 'text-sm' : ''}`}
                      skeletonClassName={embedded ? 'h-3' : 'h-4'}
                    />
                    {usingClient && !embedded && (
                      <div className="text-xs text-muted-foreground shrink-0">
                        using {usingClient}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    <FormattedTimestamp timestamp={event.created_at} />
                  </div>
                </div>
              </div>
              {!embedded && <NoteOptions event={event} className="shrink-0 [&_svg]:size-5" />}
            </div>
            <Content className="mt-2" event={event} />
          </div>
        </Collapsible>
        {!embedded && <NoteStats className="mt-3 px-4" event={event} />}
      </div>
      {!embedded && <Separator />}
    </div>
  )
}

function Content({ event, className }: { event: Event; className?: string }) {
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
      }
    })

    return { comment, url, referenceEventId }
  }, [event])
  const { event: referenceEvent } = useFetchEvent(referenceEventId)

  return (
    <div className={cn('text-wrap break-words whitespace-pre-wrap space-y-4', className)}>
      <div>{comment}</div>
      <div className="border-l-8 border-primary/40 pl-4 italic whitespace-pre-line">
        {event.content}
      </div>

      {url ? (
        <div className="truncate text-muted-foreground">
          {'— '}
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
          <div>{/* TODO: */}</div>
        ) : (
          <div className="truncate text-muted-foreground">
            {'- '}
            <a
              href={toNjump(referenceEventId)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {referenceEventId}
            </a>
          </div>
        )
      ) : null}
    </div>
  )
}

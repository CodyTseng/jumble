import { Separator } from '@/components/ui/separator'
import { BIG_RELAY_URLS, COMMENT_EVENT_KIND } from '@/constants'
import { isCommentEvent, isProtectedEvent } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Event as NEvent } from 'nostr-tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReplyNote from '../ReplyNote'

const LIMIT = 100

export default function Nip22ReplyNoteList({
  event,
  className
}: {
  event: NEvent
  className?: string
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [until, setUntil] = useState<number | undefined>(() => dayjs().unix())
  const [replies, setReplies] = useState<NEvent[]>([])
  const [replyMap, setReplyMap] = useState<
    Record<string, { event: NEvent; level: number; parent?: NEvent } | undefined>
  >({})
  const [loading, setLoading] = useState<boolean>(false)
  const [highlightReplyId, setHighlightReplyId] = useState<string | undefined>(undefined)
  const { updateNoteReplyCount } = useNoteStats()
  const replyRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleEventPublished = (data: Event) => {
      const customEvent = data as CustomEvent<NEvent>
      const evt = customEvent.detail
      if (
        isCommentEvent(evt) &&
        evt.tags.some(([tagName, tagValue]) => tagName === 'E' && tagValue === event.id)
      ) {
        onNewReply(evt)
      }
    }

    client.addEventListener('eventPublished', handleEventPublished)
    return () => {
      client.removeEventListener('eventPublished', handleEventPublished)
    }
  }, [event])

  useEffect(() => {
    if (loading) return

    const init = async () => {
      setLoading(true)
      setReplies([])

      try {
        const relayList = await client.fetchRelayList(event.pubkey)
        const relayUrls = relayList.read.concat(BIG_RELAY_URLS)
        if (isProtectedEvent(event)) {
          const seenOn = client.getSeenEventRelayUrls(event.id)
          relayUrls.unshift(...seenOn)
        }
        const { closer, timelineKey } = await client.subscribeTimeline(
          relayUrls.slice(0, 4),
          {
            '#E': [event.id],
            kinds: [COMMENT_EVENT_KIND],
            limit: LIMIT
          },
          {
            onEvents: (evts, eosed) => {
              setReplies(evts.reverse())
              if (eosed) {
                setLoading(false)
                setUntil(evts.length >= LIMIT ? evts[evts.length - 1].created_at - 1 : undefined)
              }
            },
            onNew: (evt) => {
              onNewReply(evt)
            }
          }
        )
        setTimelineKey(timelineKey)
        return closer
      } catch {
        setLoading(false)
      }
      return
    }

    const promise = init()
    return () => {
      promise.then((closer) => closer?.())
    }
  }, [event])

  useEffect(() => {
    updateNoteReplyCount(event.id, replies.length)

    const replyMap: Record<string, { event: NEvent; level: number; parent?: NEvent } | undefined> =
      {}
    for (const reply of replies) {
      const parentEventId = reply.tags.find(tagNameEquals('e'))?.[1]
      if (parentEventId && parentEventId !== event.id) {
        const parentReplyInfo = replyMap[parentEventId]
        const level = parentReplyInfo ? parentReplyInfo.level + 1 : 1
        replyMap[reply.id] = { event: reply, level, parent: parentReplyInfo?.event }
        continue
      }

      replyMap[reply.id] = { event: reply, level: 1 }
      continue
    }
    setReplyMap(replyMap)
  }, [replies, event.id, updateNoteReplyCount])

  const loadMore = useCallback(async () => {
    if (loading || !until || !timelineKey) return

    setLoading(true)
    const events = await client.loadMoreTimeline(timelineKey, until, LIMIT)
    const olderReplies = events.reverse()
    if (olderReplies.length > 0) {
      setReplies((pre) => [...olderReplies, ...pre])
    }
    setUntil(events.length ? events[events.length - 1].created_at - 1 : undefined)
    setLoading(false)
  }, [loading, until, timelineKey])

  const onNewReply = useCallback(
    (evt: NEvent) => {
      setReplies((pre) => {
        if (pre.some((reply) => reply.id === evt.id)) return pre
        return [...pre, evt]
      })
      if (evt.pubkey === pubkey) {
        setTimeout(() => {
          if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
          highlightReply(evt.id, false)
        }, 100)
      }
    },
    [pubkey]
  )

  const highlightReply = useCallback((eventId: string, scrollTo = true) => {
    if (scrollTo) {
      const ref = replyRefs.current[eventId]
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
    setHighlightReplyId(eventId)
    setTimeout(() => {
      setHighlightReplyId((pre) => (pre === eventId ? undefined : pre))
    }, 1500)
  }, [])

  return (
    <>
      {(loading || until) && (
        <div
          className={`text-sm text-center text-muted-foreground mt-2 ${!loading ? 'hover:text-foreground cursor-pointer' : ''}`}
          onClick={loadMore}
        >
          {loading ? t('loading...') : t('load more older replies')}
        </div>
      )}
      {replies.length > 0 && (loading || until) && <Separator className="mt-2" />}
      <div className={cn('mb-2', className)}>
        {replies.map((reply) => {
          const info = replyMap[reply.id]
          return (
            <div ref={(el) => (replyRefs.current[reply.id] = el)} key={reply.id}>
              <ReplyNote
                event={reply}
                parentEvent={info?.parent}
                onClickParent={highlightReply}
                highlight={highlightReplyId === reply.id}
              />
            </div>
          )
        })}
      </div>
      {replies.length === 0 && !loading && !until && (
        <div className="text-sm text-center text-muted-foreground">{t('no replies')}</div>
      )}
      <div ref={bottomRef} />
    </>
  )
}

import { Separator } from '@/components/ui/separator'
import { BIG_RELAY_URLS } from '@/constants'
import {
  getParentEventHexId,
  getRootEventHexId,
  getRootEventTag,
  isReplyNoteEvent
} from '@/lib/event'
import { generateEventIdFromETag } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import client from '@/services/client.service'
import { Event as NEvent, kinds } from 'nostr-tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReplyNote from '../ReplyNote'

const LIMIT = 100

export default function ReplyNoteList({
  index,
  event,
  className
}: {
  index?: number
  event: NEvent
  className?: string
}) {
  const { t } = useTranslation()
  const { currentIndex } = useSecondaryPage()
  const { pubkey } = useNostr()
  const [rootInfo, setRootInfo] = useState<{ id: string; pubkey: string } | undefined>(undefined)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [until, setUntil] = useState<number | undefined>(undefined)
  const [events, setEvents] = useState<NEvent[]>([])
  const [replies, setReplies] = useState<NEvent[]>([])
  const [replyMap, setReplyMap] = useState<
    Map<string, { event: NEvent; level: number; parent?: NEvent } | undefined>
  >(new Map())
  const [loading, setLoading] = useState<boolean>(false)
  const [highlightReplyId, setHighlightReplyId] = useState<string | undefined>(undefined)
  const { updateNoteReplyCount } = useNoteStats()
  const replyRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchRootEvent = async () => {
      let root = { id: event.id, pubkey: event.pubkey }
      const rootEventTag = getRootEventTag(event)
      if (rootEventTag) {
        const [, rootEventHexId, , , rootEventPubkey] = rootEventTag
        if (rootEventHexId && rootEventPubkey) {
          root = { id: rootEventHexId, pubkey: rootEventPubkey }
        } else {
          const rootEventId = generateEventIdFromETag(rootEventTag)
          if (rootEventId) {
            const rootEvent = await client.fetchEvent(rootEventId)
            if (rootEvent) {
              root = { id: rootEvent.id, pubkey: rootEvent.pubkey }
            }
          }
        }
      }
      setRootInfo(root)
    }
    fetchRootEvent()
  }, [event])

  useEffect(() => {
    if (!rootInfo) return
    const handleEventPublished = (data: Event) => {
      const customEvent = data as CustomEvent<NEvent>
      const evt = customEvent.detail
      const rootId = getRootEventHexId(evt)
      if (rootId === rootInfo.id && isReplyNoteEvent(evt)) {
        onNewReply(evt)
      }
    }

    client.addEventListener('eventPublished', handleEventPublished)
    return () => {
      client.removeEventListener('eventPublished', handleEventPublished)
    }
  }, [rootInfo])

  useEffect(() => {
    if (loading || !rootInfo || currentIndex !== index) return

    const init = async () => {
      setLoading(true)
      setEvents([])

      try {
        const relayList = await client.fetchRelayList(rootInfo.pubkey)
        const relayUrls = relayList.read.concat(BIG_RELAY_URLS)
        const seenOn = client.getSeenEventRelayUrls(rootInfo.id)
        relayUrls.unshift(...seenOn)
        const { closer, timelineKey } = await client.subscribeTimeline(
          relayUrls.slice(0, 5),
          {
            '#e': [rootInfo.id],
            kinds: [kinds.ShortTextNote],
            limit: LIMIT
          },
          {
            onEvents: (evts, eosed) => {
              if (evts.length > 0) {
                setEvents(evts.filter((evt) => isReplyNoteEvent(evt)).reverse())
              }
              if (eosed) {
                setUntil(evts.length >= LIMIT ? evts[evts.length - 1].created_at - 1 : undefined)
                setLoading(false)
              }
            },
            onNew: (evt) => {
              if (!isReplyNoteEvent(evt)) return
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
  }, [rootInfo, currentIndex, index])

  useEffect(() => {
    const replies: NEvent[] = []
    const replyMap: Map<string, { event: NEvent; level: number; parent?: NEvent } | undefined> =
      new Map()
    const rootEventId = getRootEventHexId(event) ?? event.id
    const isRootEvent = rootEventId === event.id
    for (const evt of events) {
      if (evt.created_at < event.created_at) continue

      const parentEventId = getParentEventHexId(evt)
      if (parentEventId) {
        const parentReplyInfo = replyMap.get(parentEventId)
        if (!parentReplyInfo && parentEventId !== event.id) continue

        const level = parentReplyInfo ? parentReplyInfo.level + 1 : 1
        replies.push(evt)
        replyMap.set(evt.id, { event: evt, level, parent: parentReplyInfo?.event })
        continue
      }

      if (!isRootEvent) continue

      replies.push(evt)
      replyMap.set(evt.id, { event: evt, level: 1 })
    }
    setReplyMap(replyMap)
    setReplies(replies)
    updateNoteReplyCount(event.id, replies.length)
    if (replies.length === 0) {
      loadMore()
    }
  }, [events, event, updateNoteReplyCount])

  const loadMore = useCallback(async () => {
    if (loading || !until || !timelineKey) return

    setLoading(true)
    const events = await client.loadMoreTimeline(timelineKey, until, LIMIT)
    const olderEvents = events.filter((evt) => isReplyNoteEvent(evt)).reverse()
    if (olderEvents.length > 0) {
      setEvents((pre) => [...olderEvents, ...pre])
    }
    setUntil(events.length ? events[events.length - 1].created_at - 1 : undefined)
    setLoading(false)
  }, [loading, until, timelineKey])

  const onNewReply = useCallback(
    (evt: NEvent) => {
      setEvents((pre) => {
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
      {(loading || (!!until && replies.length > 0)) && (
        <div
          className={`text-sm text-center text-muted-foreground mt-2 ${!loading ? 'hover:text-foreground cursor-pointer' : ''}`}
          onClick={loadMore}
        >
          {loading ? t('loading...') : t('load more older replies')}
        </div>
      )}
      {replies.length > 0 && (loading || until) && <Separator className="mt-2" />}
      <div className={className}>
        {replies.map((reply) => {
          const info = replyMap.get(reply.id)
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
      {!loading && (
        <div className="text-sm mt-2 text-center text-muted-foreground">
          {replies.length > 0 ? t('no more replies') : t('no replies')}
        </div>
      )}
      <div ref={bottomRef} />
    </>
  )
}

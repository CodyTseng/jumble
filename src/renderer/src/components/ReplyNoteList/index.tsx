import { Separator } from '@renderer/components/ui/separator'
import { isReplyNoteEvent } from '@renderer/lib/event'
import { isReplyETag, isRootETag } from '@renderer/lib/tag'
import { cn } from '@renderer/lib/utils'
import { useNostr } from '@renderer/providers/NostrProvider'
import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event as NEvent, kinds } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReplyNote from '../ReplyNote'

const LIMIT = 100

export default function ReplyNoteList({ event, className }: { event: NEvent; className?: string }) {
  const { t } = useTranslation()
  const { isReady, pubkey } = useNostr()
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

  useEffect(() => {
    const handleEventPublished = (data: Event) => {
      const customEvent = data as CustomEvent<NEvent>
      const evt = customEvent.detail
      if (
        isReplyNoteEvent(evt) &&
        evt.tags.some(([tagName, tagValue]) => tagName === 'e' && tagValue === event.id)
      ) {
        onNewReply(evt)
      }
    }

    client.addEventListener('eventPublished', handleEventPublished)
    return () => {
      client.removeEventListener('eventPublished', handleEventPublished)
    }
  }, [])

  useEffect(() => {
    if (!isReady || loading) return

    const init = async () => {
      setLoading(true)
      setReplies([])

      try {
        const relayList = await client.fetchRelayList(event.pubkey)
        const { closer, timelineKey } = await client.subscribeTimeline(
          relayList.read.slice(0, 5),
          {
            '#e': [event.id],
            kinds: [kinds.ShortTextNote],
            limit: LIMIT
          },
          {
            onEvents: (evts, eosed) => {
              setReplies(evts.filter((evt) => isReplyNoteEvent(evt)).reverse())
              if (eosed) {
                setLoading(false)
                setUntil(evts.length >= LIMIT ? evts[evts.length - 1].created_at - 1 : undefined)
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
  }, [isReady])

  useEffect(() => {
    updateNoteReplyCount(event.id, replies.length)

    const replyMap: Record<string, { event: NEvent; level: number; parent?: NEvent } | undefined> =
      {}
    for (const reply of replies) {
      const parentReplyTag = reply.tags.find(isReplyETag)
      if (parentReplyTag) {
        const parentReplyInfo = replyMap[parentReplyTag[1]]
        const level = parentReplyInfo ? parentReplyInfo.level + 1 : 1
        replyMap[reply.id] = { event: reply, level, parent: parentReplyInfo?.event }
        continue
      }

      const rootReplyTag = reply.tags.find(isRootETag)
      if (rootReplyTag) {
        replyMap[reply.id] = { event: reply, level: 1 }
        continue
      }

      let level = 0
      let parent: NEvent | undefined
      for (const [tagName, tagValue] of reply.tags) {
        if (tagName === 'e') {
          const info = replyMap[tagValue]
          if (info && info.level > level) {
            level = info.level
            parent = info.event
          }
        }
      }
      replyMap[reply.id] = { event: reply, level: level + 1, parent }
    }
    setReplyMap(replyMap)
  }, [replies])

  const loadMore = async () => {
    if (loading || !until || !timelineKey) return

    setLoading(true)
    const events = await client.loadMoreTimeline(timelineKey, until, LIMIT)
    const olderReplies = events.filter((evt) => isReplyNoteEvent(evt)).reverse()
    if (olderReplies.length > 0) {
      setReplies((pre) => [...olderReplies, ...pre])
    }
    setUntil(events.length ? events[events.length - 1].created_at - 1 : undefined)
    setLoading(false)
  }

  const onNewReply = (evt: NEvent) => {
    setReplies((pre) => {
      if (pre.some((reply) => reply.id === evt.id)) return pre
      return [...pre, evt]
    })
    if (evt.pubkey === pubkey) {
      setTimeout(() => {
        highlightReply(evt.id)
      }, 100)
    }
  }

  const highlightReply = (eventId: string) => {
    const ref = replyRefs.current[eventId]
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setHighlightReplyId(eventId)
    setTimeout(() => {
      setHighlightReplyId((pre) => (pre === eventId ? undefined : pre))
    }, 1500)
  }

  return (
    <>
      <div
        className={`text-sm text-center text-muted-foreground ${!loading ? 'hover:text-foreground cursor-pointer' : ''}`}
        onClick={loadMore}
      >
        {loading ? t('loading...') : until ? t('load more older replies') : null}
      </div>
      {replies.length > 0 && (loading || until) && <Separator className="my-2" />}
      <div className={cn('mb-4', className)}>
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
    </>
  )
}

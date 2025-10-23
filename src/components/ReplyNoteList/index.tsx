import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import {
  getParentETag,
  getReplaceableCoordinateFromEvent,
  getRootATag,
  getRootETag,
  getRootEventHexId,
  isMentioningMutedUsers,
  isReplaceableEvent,
  isReplyNoteEvent
} from '@/lib/event'
import { toNote } from '@/lib/link'
import { generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useReply } from '@/providers/ReplyProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { Filter, Event as NEvent, kinds } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingBar } from '../LoadingBar'
import ReplyNote, { ReplyNoteSkeleton } from '../ReplyNote'

type TRootInfo =
  | { type: 'E'; id: string; pubkey: string }
  | { type: 'A'; id: string; eventId: string; pubkey: string; relay?: string }
  | { type: 'I'; id: string }

const LIMIT = 100
const SHOW_COUNT = 10

export default function ReplyNoteList({ index, event }: { index?: number; event: NEvent }) {
  const { t } = useTranslation()
  const { push, currentIndex } = useSecondaryPage()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [rootInfo, setRootInfo] = useState<TRootInfo | undefined>(undefined)
  const { repliesMap, addReplies } = useReply()
  const replies = useMemo(() => {
    const replyIdSet = new Set<string>()
    const replyEvents: NEvent[] = []
    const currentEventKey = isReplaceableEvent(event.kind)
      ? getReplaceableCoordinateFromEvent(event)
      : event.id
    let parentEventKeys = [currentEventKey]
    while (parentEventKeys.length > 0) {
      const events = parentEventKeys.flatMap((id) => repliesMap.get(id)?.events || [])
      events.forEach((evt) => {
        if (replyIdSet.has(evt.id)) return
        if (mutePubkeySet.has(evt.pubkey)) return
        if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) return

        replyIdSet.add(evt.id)
        replyEvents.push(evt)
      })
      parentEventKeys = events.map((evt) => evt.id)
    }
    return replyEvents.sort((a, b) => a.created_at - b.created_at)
  }, [event.id, repliesMap])
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [until, setUntil] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(false)
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [highlightReplyId, setHighlightReplyId] = useState<string | undefined>(undefined)
  const replyRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchRootEvent = async () => {
      let root: TRootInfo = isReplaceableEvent(event.kind)
        ? {
            type: 'A',
            id: getReplaceableCoordinateFromEvent(event),
            eventId: event.id,
            pubkey: event.pubkey,
            relay: client.getEventHint(event.id)
          }
        : { type: 'E', id: event.id, pubkey: event.pubkey }
      const rootETag = getRootETag(event)
      if (rootETag) {
        const [, rootEventHexId, , , rootEventPubkey] = rootETag
        if (rootEventHexId && rootEventPubkey) {
          root = { type: 'E', id: rootEventHexId, pubkey: rootEventPubkey }
        } else {
          const rootEventId = generateBech32IdFromETag(rootETag)
          if (rootEventId) {
            const rootEvent = await client.fetchEvent(rootEventId)
            if (rootEvent) {
              root = { type: 'E', id: rootEvent.id, pubkey: rootEvent.pubkey }
            }
          }
        }
      } else if (event.kind === ExtendedKind.COMMENT) {
        const rootATag = getRootATag(event)
        if (rootATag) {
          const [, coordinate, relay] = rootATag
          const [, pubkey] = coordinate.split(':')
          root = { type: 'A', id: coordinate, eventId: event.id, pubkey, relay }
        }
        const rootITag = event.tags.find(tagNameEquals('I'))
        if (rootITag) {
          root = { type: 'I', id: rootITag[1] }
        }
      }
      setRootInfo(root)
    }
    fetchRootEvent()
  }, [event])

  const onNewReply = useCallback((evt: NEvent) => {
    addReplies([evt])
  }, [])

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

    client.addEventListener('newEvent', handleEventPublished)
    return () => {
      client.removeEventListener('newEvent', handleEventPublished)
    }
  }, [rootInfo, onNewReply])

  useEffect(() => {
    if (loading || !rootInfo || currentIndex !== index) return

    const init = async () => {
      setLoading(true)

      try {
        const relayList = await client.fetchRelayList(
          (rootInfo as { pubkey?: string }).pubkey ?? event.pubkey
        )
        const relayUrls = relayList.read.concat(BIG_RELAY_URLS)
        const seenOn =
          rootInfo.type === 'E'
            ? client.getSeenEventRelayUrls(rootInfo.id)
            : rootInfo.type === 'A'
              ? client.getSeenEventRelayUrls(rootInfo.eventId)
              : []
        relayUrls.unshift(...seenOn)

        const filters: (Omit<Filter, 'since' | 'until'> & {
          limit: number
        })[] = []
        if (rootInfo.type === 'E') {
          filters.push({
            '#e': [rootInfo.id],
            kinds: [kinds.ShortTextNote],
            limit: LIMIT
          })
          if (event.kind !== kinds.ShortTextNote) {
            filters.push({
              '#E': [rootInfo.id],
              kinds: [ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT],
              limit: LIMIT
            })
          }
        } else if (rootInfo.type === 'A') {
          filters.push(
            {
              '#a': [rootInfo.id],
              kinds: [kinds.ShortTextNote],
              limit: LIMIT
            },
            {
              '#A': [rootInfo.id],
              kinds: [ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT],
              limit: LIMIT
            }
          )
          if (rootInfo.relay) {
            relayUrls.push(rootInfo.relay)
          }
        } else {
          filters.push({
            '#I': [rootInfo.id],
            kinds: [ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT],
            limit: LIMIT
          })
        }
        const { closer, timelineKey } = await client.subscribeTimeline(
          filters.map((filter) => ({
            urls: relayUrls.slice(0, 5),
            filter
          })),
          {
            onEvents: (evts, eosed) => {
              if (evts.length > 0) {
                addReplies(evts.filter((evt) => isReplyNoteEvent(evt)))
              }
              if (eosed) {
                setUntil(evts.length >= LIMIT ? evts[evts.length - 1].created_at - 1 : undefined)
                setLoading(false)
              }
            },
            onNew: (evt) => {
              if (!isReplyNoteEvent(evt)) return
              addReplies([evt])
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
  }, [rootInfo, currentIndex, index, onNewReply])

  useEffect(() => {
    if (replies.length === 0) {
      loadMore()
    }
  }, [replies])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && showCount < replies.length) {
        setShowCount((prev) => prev + SHOW_COUNT)
      }
    }, options)

    const currentBottomRef = bottomRef.current

    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [replies, showCount])

  const loadMore = useCallback(async () => {
    if (loading || !until || !timelineKey) return

    setLoading(true)
    const events = await client.loadMoreTimeline(timelineKey, until, LIMIT)
    const olderEvents = events.filter((evt) => isReplyNoteEvent(evt))
    if (olderEvents.length > 0) {
      addReplies(olderEvents)
    }
    setUntil(events.length ? events[events.length - 1].created_at - 1 : undefined)
    setLoading(false)
  }, [loading, until, timelineKey])

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
    <div className="min-h-[80vh]">
      {loading && <LoadingBar />}
      {!loading && until && until > event.created_at && (
        <div
          className={`text-sm text-center text-muted-foreground border-b py-2 ${!loading ? 'hover:text-foreground cursor-pointer' : ''}`}
          onClick={loadMore}
        >
          {t('load more older replies')}
        </div>
      )}
      <div>
        {replies.slice(0, showCount).map((reply) => {
          if (hideUntrustedInteractions && !isUserTrusted(reply.pubkey)) {
            const repliesForThisReply = repliesMap.get(reply.id)
            // If the reply is not trusted and there are no trusted replies for this reply, skip rendering
            if (
              !repliesForThisReply ||
              repliesForThisReply.events.every((evt) => !isUserTrusted(evt.pubkey))
            ) {
              return null
            }
          }

          const parentETag = getParentETag(reply)
          const parentEventHexId = parentETag?.[1]
          const parentEventId = parentETag ? generateBech32IdFromETag(parentETag) : undefined
          return (
            <div
              ref={(el) => (replyRefs.current[reply.id] = el)}
              key={reply.id}
              className="scroll-mt-12"
            >
              <ReplyNote
                event={reply}
                parentEventId={event.id !== parentEventHexId ? parentEventId : undefined}
                onClickParent={() => {
                  if (!parentEventHexId) return
                  if (replies.every((r) => r.id !== parentEventHexId)) {
                    push(toNote(parentEventId ?? parentEventHexId))
                    return
                  }
                  highlightReply(parentEventHexId)
                }}
                highlight={highlightReplyId === reply.id}
              />
            </div>
          )
        })}
      </div>
      {!loading && (
        <div className="text-sm mt-2 mb-3 text-center text-muted-foreground">
          {replies.length > 0 ? t('no more replies') : t('no replies')}
        </div>
      )}
      <div ref={bottomRef} />
      {loading && <ReplyNoteSkeleton />}
    </div>
  )
}

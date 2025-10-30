import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import {
  getEventKey,
  getEventKeyFromTag,
  getParentTag,
  getReplaceableCoordinateFromEvent,
  getRootTag,
  isMentioningMutedUsers,
  isReplaceableEvent,
  isReplyNoteEvent
} from '@/lib/event'
import { toNote } from '@/lib/link'
import { generateBech32IdFromATag, generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
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
    const replyKeySet = new Set<string>()
    const replyEvents: NEvent[] = []
    const currentEventKey = getEventKey(event)
    let parentEventKeys = [currentEventKey]
    while (parentEventKeys.length > 0) {
      const events = parentEventKeys.flatMap((key) => repliesMap.get(key)?.events || [])
      events.forEach((evt) => {
        const key = getEventKey(evt)
        if (replyKeySet.has(key)) return
        if (mutePubkeySet.has(evt.pubkey)) return
        if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) return

        replyKeySet.add(key)
        replyEvents.push(evt)
      })
      parentEventKeys = events.map((evt) => getEventKey(evt))
    }
    return replyEvents.sort((a, b) => a.created_at - b.created_at)
  }, [event.id, repliesMap])
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [until, setUntil] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(false)
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [highlightReplyKey, setHighlightReplyKey] = useState<string | undefined>(undefined)
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

      const rootTag = getRootTag(event)
      if (rootTag?.type === 'e') {
        const [, rootEventHexId, , , rootEventPubkey] = rootTag.tag
        if (rootEventHexId && rootEventPubkey) {
          root = { type: 'E', id: rootEventHexId, pubkey: rootEventPubkey }
        } else {
          const rootEventId = generateBech32IdFromETag(rootTag.tag)
          if (rootEventId) {
            const rootEvent = await client.fetchEvent(rootEventId)
            if (rootEvent) {
              root = { type: 'E', id: rootEvent.id, pubkey: rootEvent.pubkey }
            }
          }
        }
      } else if (rootTag?.type === 'a') {
        const [, coordinate, relay] = rootTag.tag
        const [, pubkey] = coordinate.split(':')
        root = { type: 'A', id: coordinate, eventId: event.id, pubkey, relay }
      } else {
        const rootITag = event.tags.find(tagNameEquals('I'))
        if (rootITag) {
          root = { type: 'I', id: rootITag[1] }
        }
      }
      setRootInfo(root)
    }
    fetchRootEvent()
  }, [event])

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
  }, [rootInfo, currentIndex, index])

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

  const highlightReply = useCallback((key: string, eventId?: string, scrollTo = true) => {
    let found = false
    if (scrollTo) {
      const ref = replyRefs.current[key]
      if (ref) {
        found = true
        ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
    if (!found) {
      if (eventId) push(toNote(eventId))
      return
    }

    setHighlightReplyKey(key)
    setTimeout(() => {
      setHighlightReplyKey((pre) => (pre === key ? undefined : pre))
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
            const replyKey = getEventKey(reply)
            const repliesForThisReply = repliesMap.get(replyKey)
            // If the reply is not trusted and there are no trusted replies for this reply, skip rendering
            if (
              !repliesForThisReply ||
              repliesForThisReply.events.every((evt) => !isUserTrusted(evt.pubkey))
            ) {
              return null
            }
          }

          const rootEventKey = getEventKey(event)
          const currentReplyKey = getEventKey(reply)
          const parentTag = getParentTag(reply)
          const parentEventKey = parentTag ? getEventKeyFromTag(parentTag.tag) : undefined
          const parentEventId = parentTag
            ? parentTag.type === 'e'
              ? generateBech32IdFromETag(parentTag.tag)
              : generateBech32IdFromATag(parentTag.tag)
            : undefined
          return (
            <div
              ref={(el) => (replyRefs.current[currentReplyKey] = el)}
              key={currentReplyKey}
              className="scroll-mt-12"
            >
              <ReplyNote
                event={reply}
                parentEventId={rootEventKey !== parentEventKey ? parentEventId : undefined}
                onClickParent={() => {
                  if (!parentEventKey) return
                  highlightReply(parentEventKey, parentEventId)
                }}
                highlight={highlightReplyKey === currentReplyKey}
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

import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { useStuff } from '@/hooks/useStuff'
import {
  getEventKey,
  getReplaceableCoordinateFromEvent,
  getRootTag,
  isMentioningMutedUsers,
  isProtectedEvent,
  isReplaceableEvent
} from '@/lib/event'
import { generateBech32IdFromETag } from '@/lib/tag'
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
import SubReplies from './SubReplies'

type TRootInfo =
  | { type: 'E'; id: string; pubkey: string }
  | { type: 'A'; id: string; pubkey: string; relay?: string }
  | { type: 'I'; id: string }

const LIMIT = 100
const SHOW_COUNT = 10

export default function ReplyNoteList({
  stuff,
  index
}: {
  stuff: NEvent | string
  index?: number
}) {
  const { t } = useTranslation()
  const { currentIndex } = useSecondaryPage()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [rootInfo, setRootInfo] = useState<TRootInfo | undefined>(undefined)
  const { repliesMap, addReplies } = useReply()
  const { event, externalContent, stuffKey } = useStuff(stuff)
  const replies = useMemo(() => {
    const replyKeySet = new Set<string>()
    const replyEvents = (repliesMap.get(stuffKey)?.events || []).filter((evt) => {
      const key = getEventKey(evt)
      if (replyKeySet.has(key)) return false
      if (mutePubkeySet.has(evt.pubkey)) return false
      if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) {
        return false
      }
      if (hideUntrustedInteractions && !isUserTrusted(evt.pubkey)) {
        const replyKey = getEventKey(evt)
        const repliesForThisReply = repliesMap.get(replyKey)
        // If the reply is not trusted and there are no trusted replies for this reply, skip rendering
        if (
          !repliesForThisReply ||
          repliesForThisReply.events.every((evt) => !isUserTrusted(evt.pubkey))
        ) {
          return false
        }
      }

      replyKeySet.add(key)
      return true
    })
    return replyEvents.sort((a, b) => a.created_at - b.created_at)
  }, [
    stuffKey,
    repliesMap,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    hideUntrustedInteractions
  ])
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [until, setUntil] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(false)
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchRootEvent = async () => {
      if (!event && !externalContent) return

      let root: TRootInfo = event
        ? isReplaceableEvent(event.kind)
          ? {
              type: 'A',
              id: getReplaceableCoordinateFromEvent(event),
              pubkey: event.pubkey,
              relay: client.getEventHint(event.id)
            }
          : { type: 'E', id: event.id, pubkey: event.pubkey }
        : { type: 'I', id: externalContent! }

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
        root = { type: 'A', id: coordinate, pubkey, relay }
      } else if (rootTag?.type === 'i') {
        root = { type: 'I', id: rootTag.tag[1] }
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
        let relayUrls: string[] = []
        const rootPubkey = (rootInfo as { pubkey?: string }).pubkey ?? event?.pubkey
        if (rootPubkey) {
          const relayList = await client.fetchRelayList(rootPubkey)
          relayUrls = relayList.read
        }
        relayUrls = relayUrls.concat(BIG_RELAY_URLS).slice(0, 4)

        // If current event is protected, we can assume its replies are also protected and stored on the same relays
        if (event && isProtectedEvent(event)) {
          const seenOn = client.getSeenEventRelayUrls(event.id)
          relayUrls.concat(...seenOn)
        }

        const filters: (Omit<Filter, 'since' | 'until'> & {
          limit: number
        })[] = []
        if (rootInfo.type === 'E') {
          filters.push({
            '#e': [rootInfo.id],
            kinds: [kinds.ShortTextNote],
            limit: LIMIT
          })
          if (event?.kind !== kinds.ShortTextNote) {
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
            urls: relayUrls.slice(0, 8),
            filter
          })),
          {
            onEvents: (evts, eosed) => {
              if (evts.length > 0) {
                addReplies(evts)
              }
              if (eosed) {
                setUntil(evts.length >= LIMIT ? evts[evts.length - 1].created_at - 1 : undefined)
                setLoading(false)
              }
            },
            onNew: (evt) => {
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
    addReplies(events)
    setUntil(events.length ? events[events.length - 1].created_at - 1 : undefined)
    setLoading(false)
  }, [loading, until, timelineKey])

  return (
    <div className="min-h-[80vh]">
      {loading && <LoadingBar />}
      {!loading && until && (!event || until > event.created_at) && (
        <div
          className={`text-sm text-center text-muted-foreground border-b py-2 ${!loading ? 'hover:text-foreground cursor-pointer' : ''}`}
          onClick={loadMore}
        >
          {t('load more older replies')}
        </div>
      )}
      <div>
        {replies.slice(0, showCount).map((reply) => {
          const key = getEventKey(reply)
          return (
            <div key={key}>
              <ReplyNote event={reply} />
              <SubReplies parentKey={key} />
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

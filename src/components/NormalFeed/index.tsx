import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { ExtendedKind } from '@/constants'
import { isReplyNoteEvent } from '@/lib/event'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { TNormalFeedSubRequest, TNoteListMode } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'

const LIMIT = 100
const ALGO_LIMIT = 500
const KINDS = [
  kinds.ShortTextNote,
  kinds.Repost,
  kinds.Highlights,
  kinds.LongFormArticle,
  ExtendedKind.COMMENT,
  ExtendedKind.POLL,
  ExtendedKind.VOICE,
  ExtendedKind.VOICE_COMMENT,
  ExtendedKind.PICTURE
]

export default function NormalFeed({
  subRequests,
  areAlgoRelays = false
}: {
  subRequests: TNormalFeedSubRequest[]
  areAlgoRelays?: boolean
}) {
  const { startLogin } = useNostr()
  const { isUserTrusted, hideUntrustedNotes } = useUserTrust()
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const [events, setEvents] = useState<Event[]>([])
  const [newEvents, setNewEvents] = useState<Event[]>([])
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [refreshCount, setRefreshCount] = useState(0)
  const noteListRef = useRef<TNoteListRef>(null)
  const filteredNewEvents = useMemo(() => {
    return newEvents.filter((event: Event) => {
      return (
        (listMode !== 'posts' || !isReplyNoteEvent(event)) &&
        (!hideUntrustedNotes || isUserTrusted(event.pubkey))
      )
    })
  }, [newEvents, listMode, hideUntrustedNotes])

  useEffect(() => {
    if (!subRequests.length) return

    async function init() {
      setLoading(true)
      setEvents([])
      setNewEvents([])
      setHasMore(true)

      const { closer, timelineKey } = await client.subscribeTimeline(
        subRequests.map(({ urls, filter }) => ({
          urls,
          filter: {
            ...filter,
            kinds: KINDS,
            limit: areAlgoRelays ? ALGO_LIMIT : LIMIT
          }
        })),
        {
          onEvents: (events, eosed) => {
            if (events.length > 0) {
              setEvents(events)
            }
            if (areAlgoRelays) {
              setHasMore(false)
            }
            if (eosed) {
              setLoading(false)
              setHasMore(events.length > 0)
            }
          },
          onNew: (event) => {
            setNewEvents((oldEvents) =>
              [event, ...oldEvents].sort((a, b) => b.created_at - a.created_at)
            )
          }
        },
        {
          startLogin,
          needSort: !areAlgoRelays
        }
      )
      setTimelineKey(timelineKey)
      return closer
    }

    const promise = init()
    return () => {
      promise.then((closer) => closer())
    }
  }, [JSON.stringify(subRequests), refreshCount])

  const loadMore = async () => {
    if (!timelineKey || areAlgoRelays) return
    setLoading(true)
    const newEvents = await client.loadMoreTimeline(
      timelineKey,
      events.length ? events[events.length - 1].created_at - 1 : dayjs().unix(),
      LIMIT
    )
    setLoading(false)
    if (newEvents.length === 0) {
      setHasMore(false)
      return
    }
    setEvents((oldEvents) => [...oldEvents, ...newEvents])
  }

  const showNewEvents = () => {
    setEvents((oldEvents) => [...newEvents, ...oldEvents])
    setNewEvents([])
    setTimeout(() => {
      noteListRef.current?.scrollToTop()
    }, 0)
  }

  const handleListModeChange = (mode: TNoteListMode) => {
    setListMode(mode)
    storage.setNoteListMode(mode)
    setTimeout(() => {
      noteListRef.current?.scrollToTop()
    }, 0)
  }

  return (
    <>
      <Tabs
        value={listMode}
        tabs={[
          { value: 'posts', label: 'Notes' },
          { value: 'postsAndReplies', label: 'Replies' }
        ]}
        onTabChange={(listMode) => {
          handleListModeChange(listMode as TNoteListMode)
        }}
      />
      <NoteList
        ref={noteListRef}
        events={events.filter(
          (event: Event) =>
            (listMode !== 'posts' || !isReplyNoteEvent(event)) &&
            (!hideUntrustedNotes || isUserTrusted(event.pubkey))
        )}
        hasMore={hasMore}
        loading={loading}
        loadMore={loadMore}
        onRefresh={() => {
          setRefreshCount((count) => count + 1)
        }}
        newEvents={filteredNewEvents}
        showNewEvents={showNewEvents}
      />
    </>
  )
}

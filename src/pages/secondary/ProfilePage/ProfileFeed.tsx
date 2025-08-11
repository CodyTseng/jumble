import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { isReplyNoteEvent } from '@/lib/event'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { TNoteListMode, TSubRequest } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'

const LIMIT = 100
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

export default function ProfileFeed({
  pubkey,
  topSpace = 0
}: {
  pubkey: string
  topSpace?: number
}) {
  const { startLogin, pubkey: myPubkey } = useNostr()
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
      return listMode !== 'posts' || !isReplyNoteEvent(event)
    })
  }, [newEvents, listMode])
  const [subRequests, setSubRequests] = useState<TSubRequest[]>([])
  const tabs = useMemo(() => {
    const _tabs = [
      { value: 'posts', label: 'Notes' },
      { value: 'postsAndReplies', label: 'Replies' }
    ]

    if (myPubkey && myPubkey !== pubkey) {
      _tabs.push({ value: 'you', label: 'YouTabName' })
    }

    return _tabs
  }, [myPubkey, pubkey])

  useEffect(() => {
    const init = async () => {
      if (listMode === 'you') {
        if (!myPubkey) {
          setSubRequests([])
          return
        }

        const [relayList, myRelayList] = await Promise.all([
          client.fetchRelayList(pubkey),
          client.fetchRelayList(myPubkey)
        ])

        setSubRequests([
          {
            urls: myRelayList.write.concat(BIG_RELAY_URLS).slice(0, 5),
            filter: {
              kinds: KINDS,
              authors: [myPubkey],
              '#p': [pubkey],
              limit: LIMIT
            }
          },
          {
            urls: relayList.write.concat(BIG_RELAY_URLS).slice(0, 5),
            filter: {
              kinds: KINDS,
              authors: [pubkey],
              '#p': [myPubkey],
              limit: LIMIT
            }
          }
        ])
        return
      }

      const relayList = await client.fetchRelayList(pubkey)
      setSubRequests([
        {
          urls: relayList.write.concat(BIG_RELAY_URLS).slice(0, 5),
          filter: {
            kinds: KINDS,
            authors: [pubkey],
            limit: LIMIT
          }
        }
      ])
    }
    init()
  }, [pubkey, listMode])

  useEffect(() => {
    if (!subRequests.length) return

    async function init() {
      setLoading(true)
      setEvents([])
      setNewEvents([])
      setHasMore(true)

      const { closer, timelineKey } = await client.subscribeTimeline(
        subRequests,
        {
          onEvents: (events, eosed) => {
            if (events.length > 0) {
              setEvents(events)
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
          startLogin
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
    if (!timelineKey) return
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
    setTimeout(() => {
      noteListRef.current?.scrollToTop()
    }, 0)
  }

  return (
    <>
      <Tabs
        value={listMode}
        tabs={tabs}
        onTabChange={(listMode) => {
          handleListModeChange(listMode as TNoteListMode)
        }}
        threshold={Math.max(800, topSpace)}
      />
      <NoteList
        ref={noteListRef}
        events={events.filter((event: Event) => listMode !== 'posts' || !isReplyNoteEvent(event))}
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

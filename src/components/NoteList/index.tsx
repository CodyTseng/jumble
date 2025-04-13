import { Button } from '@/components/ui/button'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { isReplyNoteEvent } from '@/lib/event'
import { checkAlgoRelay } from '@/lib/relay'
import { isSafari } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import relayInfoService from '@/services/relay-info.service'
import { TNoteListMode } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'
import { PictureNoteCardMasonry } from '../PictureNoteCardMasonry'
import { ShowNewButton } from '../ShowNewButton'
import TabSwitcher from '../TabSwitch'

const LIMIT = 100
const ALGO_LIMIT = 500
const SHOW_COUNT = 10

export default function NoteList({
  relayUrls = [],
  filter = {},
  className,
  filterMutedNotes = true,
  needCheckAlgoRelay = false
}: {
  relayUrls?: string[]
  filter?: Filter
  className?: string
  filterMutedNotes?: boolean
  needCheckAlgoRelay?: boolean
}) {
  const { t } = useTranslation()
  const { isLargeScreen } = useScreenSize()
  const { pubkey, startLogin } = useNostr()
  const { mutePubkeys } = useMuteList()
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [events, setEvents] = useState<Event[]>([])
  const [newEvents, setNewEvents] = useState<Event[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const isPictures = useMemo(() => listMode === 'pictures', [listMode])
  const noteFilter = useMemo(() => {
    return {
      kinds: isPictures ? [ExtendedKind.PICTURE] : [kinds.ShortTextNote, kinds.Repost],
      ...filter
    }
  }, [JSON.stringify(filter), isPictures])
  const topRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (relayUrls.length === 0 && !noteFilter.authors?.length) return

    async function init() {
      setLoading(true)
      setEvents([])
      setNewEvents([])
      setHasMore(true)

      let areAlgoRelays = false
      if (needCheckAlgoRelay) {
        const relayInfos = await relayInfoService.getRelayInfos(relayUrls)
        areAlgoRelays = relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo))
      }

      const _filter = { ...noteFilter, limit: areAlgoRelays ? ALGO_LIMIT : LIMIT }
      const subRequests: {
        urls: string[]
        filter: Omit<Filter, 'since' | 'until'> & { limit: number }
      }[] = []
      if (relayUrls.length === 0 && noteFilter.authors && noteFilter.authors.length) {
        // If many websocket connections are initiated simultaneously, it will be
        // very slow on Safari (for unknown reason)
        if ((noteFilter.authors?.length ?? 0) > 5 && isSafari()) {
          if (!pubkey) {
            subRequests.push({ urls: BIG_RELAY_URLS, filter: _filter })
          } else {
            const relayList = await client.fetchRelayList(pubkey)
            const urls = relayList.read.concat(BIG_RELAY_URLS).slice(0, 5)
            subRequests.push({ urls, filter: _filter })
          }
        } else {
          const relayLists = await client.fetchRelayLists(noteFilter.authors)
          const group: Record<string, Set<string>> = {}
          relayLists.forEach((relayList, index) => {
            relayList.write.slice(0, 4).forEach((url) => {
              if (!group[url]) {
                group[url] = new Set()
              }
              group[url].add(noteFilter.authors![index])
            })
          })

          const relayCount = Object.keys(group).length
          const coveredCount = new Map<string, number>()
          Object.entries(group)
            .sort(([, a], [, b]) => b.size - a.size)
            .forEach(([url, pubkeys]) => {
              if (
                relayCount > 10 &&
                pubkeys.size < 10 &&
                Array.from(pubkeys).every((pubkey) => (coveredCount.get(pubkey) ?? 0) >= 2)
              ) {
                delete group[url]
              } else {
                pubkeys.forEach((pubkey) => {
                  coveredCount.set(pubkey, (coveredCount.get(pubkey) ?? 0) + 1)
                })
              }
            })

          subRequests.push(
            ...Object.entries(group).map(([url, authors]) => ({
              urls: [url],
              filter: { ..._filter, authors: Array.from(authors) }
            }))
          )
        }
      } else {
        subRequests.push({ urls: relayUrls, filter: _filter })
      }

      const { closer, timelineKey } = await client.subscribeTimeline(
        subRequests,
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
  }, [JSON.stringify(relayUrls), noteFilter, refreshCount])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const loadMore = async () => {
      if (showCount < events.length) {
        setShowCount((prev) => prev + SHOW_COUNT)
        // preload more
        if (events.length - showCount > LIMIT / 2) {
          return
        }
      }

      if (!timelineKey || loading || !hasMore) return
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

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
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
  }, [timelineKey, loading, hasMore, events, noteFilter, showCount])

  const showNewEvents = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    setEvents((oldEvents) => [...newEvents, ...oldEvents])
    setNewEvents([])
  }

  return (
    <div className={className}>
      <TabSwitcher
        value={listMode}
        tabs={[
          { value: 'posts', label: 'Notes' },
          { value: 'postsAndReplies', label: 'Replies' },
          { value: 'pictures', label: 'Pictures' }
        ]}
        onTabChange={(listMode) => {
          setListMode(listMode as TNoteListMode)
          setShowCount(SHOW_COUNT)
          topRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
          storage.setNoteListMode(listMode as TNoteListMode)
        }}
      />
      <div ref={topRef} />
      {events.length > 0 &&
        newEvents.filter((event: Event) => {
          return (
            (!filterMutedNotes || !mutePubkeys.includes(event.pubkey)) &&
            (listMode !== 'posts' || !isReplyNoteEvent(event))
          )
        }).length > 0 && <ShowNewButton onClick={showNewEvents} />}
      <PullToRefresh
        onRefresh={async () => {
          setRefreshCount((count) => count + 1)
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }}
        pullingContent=""
      >
        <div>
          {isPictures ? (
            <PictureNoteCardMasonry
              className="px-2 sm:px-4 mt-2"
              columnCount={isLargeScreen ? 3 : 2}
              events={events.slice(0, showCount)}
            />
          ) : (
            <div>
              {events
                .slice(0, showCount)
                .filter((event: Event) => listMode !== 'posts' || !isReplyNoteEvent(event))
                .map((event) => (
                  <NoteCard
                    key={event.id}
                    className="w-full"
                    event={event}
                    filterMutedNotes={filterMutedNotes}
                  />
                ))}
            </div>
          )}
          {hasMore || loading ? (
            <div ref={bottomRef}>
              <NoteCardLoadingSkeleton isPictures={isPictures} />
            </div>
          ) : events.length ? (
            <div className="text-center text-sm text-muted-foreground mt-2">
              {t('no more notes')}
            </div>
          ) : (
            <div className="flex justify-center w-full mt-2">
              <Button size="lg" onClick={() => setRefreshCount((pre) => pre + 1)}>
                {t('reload notes')}
              </Button>
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

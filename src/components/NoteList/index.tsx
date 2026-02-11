import NewNotesButton from '@/components/NewNotesButton'
import { Button } from '@/components/ui/button'
import { SPAMMER_PERCENTILE_THRESHOLD } from '@/constants'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { getEventKey, getKeyFromTag, isMentioningMutedUsers, isReplyNoteEvent } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import { mergeTimelines } from '@/lib/timeline'
import { isTouchDevice } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import threadService from '@/services/thread.service'
import { TFeedSubRequest } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { decode } from 'nostr-tools/nip19'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { toast } from 'sonner'
import { LoadingBar } from '../LoadingBar'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'
import PinnedNoteCard from '../PinnedNoteCard'

const LIMIT = 200
const ALGO_LIMIT = 500
const SHOW_COUNT = 10
const AUTO_REFRESH_HIDDEN_MIN_MS = 60 * 1000 // 1 minute

export type TNoteListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  refresh: () => void
}

const NoteList = forwardRef<
  TNoteListRef,
  {
    subRequests: TFeedSubRequest[]
    showKinds?: number[]
    filterMutedNotes?: boolean
    hideReplies?: boolean
    hideSpam?: boolean
    trustScoreThreshold?: number
    areAlgoRelays?: boolean
    showRelayCloseReason?: boolean
    pinnedEventIds?: string[]
    filterFn?: (event: Event) => boolean
    showNewNotesDirectly?: boolean
    isPubkeyFeed?: boolean
  }
>(
  (
    {
      subRequests,
      showKinds,
      filterMutedNotes = true,
      hideReplies = false,
      hideSpam = false,
      trustScoreThreshold,
      areAlgoRelays = false,
      showRelayCloseReason = false,
      pinnedEventIds,
      filterFn,
      showNewNotesDirectly = false,
      isPubkeyFeed = false
    },
    ref
  ) => {
    const { t } = useTranslation()
    const active = usePageActive()
    const { startLogin } = useNostr()
    const { isSpammer, meetsMinTrustScore } = useUserTrust()
    const { mutePubkeySet } = useMuteList()
    const { hideContentMentioningMutedUsers, mutedWords } = useContentPolicy()
    const { isEventDeleted } = useDeletedEvent()
    const [storedEvents, setStoredEvents] = useState<Event[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [newEvents, setNewEvents] = useState<Event[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [filtering, setFiltering] = useState(false)
    const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
    const [filteredNotes, setFilteredNotes] = useState<
      { key: string; event: Event; reposters: string[] }[]
    >([])
    const [filteredNewEvents, setFilteredNewEvents] = useState<Event[]>([])
    const [refreshCount, setRefreshCount] = useState(0)
    const supportTouch = useMemo(() => isTouchDevice(), [])
    const topRef = useRef<HTMLDivElement | null>(null)
    const lastHiddenAtRef = useRef<number | null>(null)
    const sinceRef = useRef<number | undefined>(undefined)
    sinceRef.current = newEvents.length
      ? newEvents[0].created_at + 1
      : events.length
        ? events[0].created_at + 1
        : undefined
    const showNewNotesDirectlyRef = useRef(showNewNotesDirectly)
    showNewNotesDirectlyRef.current = showNewNotesDirectly

    // When a laptop lid closes / app backgrounds, websocket subscriptions can go stale.
    // On resume, trigger a refresh so feeds catch up without requiring a manual reload.
    useEffect(() => {
      const maybeRefresh = () => {
        if (!active) return
        if (document.visibilityState !== 'visible') return

        const lastHiddenAt = lastHiddenAtRef.current
        if (!lastHiddenAt) return
        if (Date.now() - lastHiddenAt < AUTO_REFRESH_HIDDEN_MIN_MS) return

        lastHiddenAtRef.current = null
        setRefreshCount((count) => count + 1)
      }

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          lastHiddenAtRef.current = Date.now()
          return
        }
        maybeRefresh()
      }

      const handleFocus = () => {
        maybeRefresh()
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('focus', handleFocus)
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('focus', handleFocus)
      }
    }, [active])

    const pinnedEventHexIdSet = useMemo(() => {
      const set = new Set<string>()
      pinnedEventIds?.forEach((id) => {
        try {
          const { type, data } = decode(id)
          if (type === 'nevent') {
            set.add(data.id)
          }
        } catch {
          // ignore
        }
      })
      return set
    }, [pinnedEventIds?.join(',')])

    const shouldHideEvent = useCallback(
      (evt: Event) => {
        if (pinnedEventHexIdSet.has(evt.id)) return true
        if (isEventDeleted(evt)) return true
        if (filterMutedNotes && mutePubkeySet.has(evt.pubkey)) return true
        if (
          filterMutedNotes &&
          hideContentMentioningMutedUsers &&
          isMentioningMutedUsers(evt, mutePubkeySet)
        ) {
          return true
        }
        if (filterFn && !filterFn(evt)) {
          return true
        }
        if (mutedWords.length > 0) {
          const contentLower = evt.content.toLowerCase()
          for (const word of mutedWords) {
            if (contentLower.includes(word)) {
              return true
            }
          }
        }

        return false
      },
      [mutePubkeySet, isEventDeleted, filterFn, mutedWords, pinnedEventHexIdSet]
    )

    useEffect(() => {
      const processEvents = async () => {
        // Store processed event keys to avoid duplicates
        const keySet = new Set<string>()
        // Map to track reposters for each event key
        const repostersMap = new Map<string, Set<string>>()
        // Final list of filtered events
        const filteredEvents: Event[] = []
        const keys: string[] = []

        let mergedEvents: Event[] = events
        if (
          storedEvents.length &&
          (!events.length || storedEvents[0].created_at >= events[events.length - 1].created_at)
        ) {
          mergedEvents = mergeTimelines([storedEvents, events])
        }
        mergedEvents.forEach((evt) => {
          const key = getEventKey(evt)
          if (keySet.has(key)) return
          keySet.add(key)

          if (shouldHideEvent(evt)) return
          if (hideReplies && isReplyNoteEvent(evt)) return
          if (evt.kind !== kinds.Repost && evt.kind !== kinds.GenericRepost) {
            filteredEvents.push(evt)
            keys.push(key)
            return
          }

          let targetEventKey: string | undefined
          let eventFromContent: Event | null = null
          const targetTag = evt.tags.find(tagNameEquals('a')) ?? evt.tags.find(tagNameEquals('e'))
          if (targetTag) {
            targetEventKey = getKeyFromTag(targetTag)
          } else {
            // Attempt to extract the target event from the repost content
            if (evt.content) {
              try {
                eventFromContent = JSON.parse(evt.content) as Event
              } catch {
                eventFromContent = null
              }
            }
            if (eventFromContent) {
              if (
                eventFromContent.kind === kinds.Repost ||
                eventFromContent.kind === kinds.GenericRepost
              ) {
                return
              }
              if (shouldHideEvent(evt)) return

              targetEventKey = getEventKey(eventFromContent)
            }
          }

          if (targetEventKey) {
            // Add to reposters map
            const reposters = repostersMap.get(targetEventKey)
            if (reposters) {
              reposters.add(evt.pubkey)
            } else {
              repostersMap.set(targetEventKey, new Set([evt.pubkey]))
            }

            // If the target event is not already included, add it now
            if (!keySet.has(targetEventKey)) {
              filteredEvents.push(evt)
              keys.push(targetEventKey)
              keySet.add(targetEventKey)
            }
          }
        })

        const _trustScoreThreshold = hideSpam
          ? SPAMMER_PERCENTILE_THRESHOLD
          : (trustScoreThreshold ?? 0)
        if (!_trustScoreThreshold || _trustScoreThreshold <= 0) {
          setFilteredNotes(
            filteredEvents.map((evt, i) => {
              const key = keys[i]
              return { key, event: evt, reposters: Array.from(repostersMap.get(key) ?? []) }
            })
          )
          return
        }

        const _filteredNotes = (
          await Promise.all(
            filteredEvents.map(async (evt, i) => {
              // Check trust score filter
              if (!(await meetsMinTrustScore(evt.pubkey, _trustScoreThreshold))) {
                return null
              }
              const key = keys[i]
              return { key, event: evt, reposters: Array.from(repostersMap.get(key) ?? []) }
            })
          )
        ).filter(Boolean) as {
          key: string
          event: Event
          reposters: string[]
        }[]

        setFilteredNotes(_filteredNotes)
      }

      setFiltering(true)
      processEvents().finally(() => setFiltering(false))
    }, [
      events,
      storedEvents,
      shouldHideEvent,
      hideReplies,
      hideSpam,
      meetsMinTrustScore,
      trustScoreThreshold
    ])

    useEffect(() => {
      const processNewEvents = async () => {
        const keySet = new Set<string>()
        const filteredEvents: Event[] = []

        newEvents.forEach((event) => {
          if (shouldHideEvent(event)) return
          if (hideReplies && isReplyNoteEvent(event)) return

          const key = getEventKey(event)
          if (keySet.has(key)) {
            return
          }
          keySet.add(key)
          filteredEvents.push(event)
        })

        const _trustScoreThreshold = hideSpam
          ? SPAMMER_PERCENTILE_THRESHOLD
          : (trustScoreThreshold ?? 0)
        if (!_trustScoreThreshold || _trustScoreThreshold <= 0) {
          setFilteredNewEvents(filteredEvents)
          return
        }

        const _filteredNotes = (
          await Promise.all(
            filteredEvents.map(async (evt) => {
              if (hideSpam && (await isSpammer(evt.pubkey))) {
                return null
              }
              // Check trust score filter
              if (!(await meetsMinTrustScore(evt.pubkey, _trustScoreThreshold))) {
                return null
              }
              return evt
            })
          )
        ).filter(Boolean) as Event[]
        setFilteredNewEvents(_filteredNotes)
      }
      processNewEvents()
    }, [newEvents, shouldHideEvent, isSpammer, hideSpam, meetsMinTrustScore, trustScoreThreshold])

    const scrollToTop = (behavior: ScrollBehavior = 'instant') => {
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior, block: 'start' })
      }, 20)
    }

    const refresh = () => {
      scrollToTop()
      setTimeout(() => {
        setRefreshCount((count) => count + 1)
      }, 500)
    }

    useImperativeHandle(ref, () => ({ scrollToTop, refresh }), [])

    useEffect(() => {
      if (!subRequests.length) return

      sinceRef.current = undefined
      setEvents([])
      setStoredEvents([])
      setNewEvents([])
    }, [JSON.stringify(subRequests), refreshCount, JSON.stringify(showKinds)])

    useEffect(() => {
      if (!subRequests.length || !active) return

      async function init() {
        setInitialLoading(true)

        if (showKinds?.length === 0 && subRequests.every(({ filter }) => !filter.kinds)) {
          return () => {}
        }

        const since = sinceRef.current

        if (isPubkeyFeed) {
          const storedEvents = await client.getEventsFromIndexed({
            authors: subRequests.flatMap(({ filter }) => filter.authors ?? []),
            kinds: showKinds,
            limit: LIMIT
          })
          setStoredEvents(storedEvents)
        }

        const preprocessedSubRequests = await Promise.all(
          subRequests.map(async ({ urls, filter }) => {
            const relays = urls.length ? urls : await client.determineRelaysByFilter(filter)
            return {
              urls: relays,
              filter: {
                kinds: showKinds ?? [],
                ...filter,
                limit: areAlgoRelays ? ALGO_LIMIT : LIMIT
              }
            }
          })
        )

        const handleNewEvents = (newEvents: Event[]) => {
          if (showNewNotesDirectlyRef.current) {
            setEvents((oldEvents) => mergeTimelines([newEvents, oldEvents]))
          } else {
            const isAtTop = (() => {
              if (!topRef.current) return true
              const rect = topRef.current.getBoundingClientRect()
              return rect.top >= 50
            })()

            if (isAtTop) {
              setEvents((oldEvents) => mergeTimelines([newEvents, oldEvents]))
            } else {
              setNewEvents((oldEvents) => mergeTimelines([newEvents, oldEvents]))
            }
          }
        }

        const { closer, timelineKey } = await client.subscribeTimeline(
          preprocessedSubRequests,
          {
            onEvents: (events, eosed) => {
              if (events.length > 0) {
                if (!since) {
                  setEvents(events)
                } else {
                  const newEvents = events.filter((evt) => evt.created_at >= since)
                  handleNewEvents(newEvents)
                }
              }
              if (eosed) {
                threadService.addRepliesToThread(events)
                setInitialLoading(false)
              }
            },
            onNew: (event) => {
              handleNewEvents([event])
              threadService.addRepliesToThread([event])
            },
            onClose: (url, reason) => {
              if (!showRelayCloseReason) return
              // ignore reasons from nostr-tools
              if (
                [
                  'closed by caller',
                  'relay connection errored',
                  'relay connection closed',
                  'pingpong timed out',
                  'relay connection closed by us'
                ].includes(reason)
              ) {
                return
              }

              toast.error(`${url}: ${reason}`)
            }
          },
          {
            startLogin,
            needSort: !areAlgoRelays,
            needSaveToDb: isPubkeyFeed
          }
        )
        setTimelineKey(timelineKey)
        return closer
      }

      const promise = init()
      return () => {
        promise.then((closer) => closer())
      }
    }, [JSON.stringify(subRequests), refreshCount, JSON.stringify(showKinds), active])

    const handleLoadMore = useCallback(async () => {
      if (!timelineKey || areAlgoRelays) return false
      const newEvents = await client.loadMoreTimeline(
        timelineKey,
        events.length ? events[events.length - 1].created_at - 1 : dayjs().unix(),
        LIMIT
      )
      if (newEvents.length === 0) {
        return false
      }
      setEvents((oldEvents) => [...oldEvents, ...newEvents])
      return true
    }, [timelineKey, events, areAlgoRelays])

    const { visibleItems, shouldShowLoadingIndicator, bottomRef } = useInfiniteScroll({
      items: filteredNotes,
      showCount: SHOW_COUNT,
      onLoadMore: handleLoadMore,
      initialLoading
    })

    const showNewEvents = () => {
      setEvents((oldEvents) => mergeTimelines([newEvents, oldEvents]))
      setNewEvents([])
      setTimeout(() => {
        scrollToTop('smooth')
      }, 0)
    }

    const list = (
      <div className="min-h-screen">
        {initialLoading && shouldShowLoadingIndicator && <LoadingBar />}
        {pinnedEventIds?.map((id) => <PinnedNoteCard key={id} eventId={id} className="w-full" />)}
        {visibleItems.map(({ key, event, reposters }) => (
          <NoteCard
            key={key}
            className="w-full"
            event={event}
            filterMutedNotes={filterMutedNotes}
            reposters={reposters}
          />
        ))}
        <div ref={bottomRef} />
        {shouldShowLoadingIndicator || filtering || initialLoading ? (
          <NoteCardLoadingSkeleton />
        ) : events.length ? (
          <div className="mt-2 text-center text-sm text-muted-foreground">{t('no more notes')}</div>
        ) : (
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-4">
            <div className="text-center text-muted-foreground">
              <div className="text-lg font-medium">{t('No notes found')}</div>
              <div className="mt-1 text-sm">{t('Try again later or check your connection')}</div>
            </div>
            <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
              {t('Reload')}
            </Button>
          </div>
        )}
      </div>
    )

    return (
      <div>
        <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
        {supportTouch ? (
          <PullToRefresh
            onRefresh={async () => {
              refresh()
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }}
            pullingContent=""
          >
            {list}
          </PullToRefresh>
        ) : (
          list
        )}
        <div className="h-20" />
        {filteredNewEvents.length > 0 && (
          <NewNotesButton newEvents={filteredNewEvents} onClick={showNewEvents} />
        )}
      </div>
    )
  }
)
NoteList.displayName = 'NoteList'
export default NoteList

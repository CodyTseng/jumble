import NoteCard from '@/components/NoteCard'
import { SimpleUsername } from '@/components/Username'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { PULSE_EVENTS_PER_USER_CAP } from '@/lib/pulse'
import { getDefaultRelayUrls } from '@/lib/relay'
import { mergeTimelines } from '@/lib/timeline'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import userAggregationService from '@/services/user-aggregation.service'
import { TSubRequestFilter } from '@/types'
import { nip19, NostrEvent } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Mirror the parent feed's `showKinds` (registered by DeepPulseList in
// userAggregationService) so this page doesn't surface kinds the feed
// itself filtered out (kind 30618, cashu wallet ops, etc.). When the
// service has no kinds registered (e.g. deep-linking to /user-aggregation/
// without first opening the feed), fall back to no kinds filter so the
// user at least sees something.
const FETCH_LIMIT = 50

const UserAggregationDetailPage = forwardRef(
  (
    {
      feedId,
      npub,
      index
    }: {
      feedId?: string
      npub?: string
      index?: number
    },
    ref
  ) => {
    const { t } = useTranslation()
    const [serviceEvents, setServiceEvents] = useState<NostrEvent[]>([])
    const [liveEvents, setLiveEvents] = useState<NostrEvent[]>([])
    const [isPulseBackfilling, setIsPulseBackfilling] = useState(false)
    const [isInitialLoading, setIsInitialLoading] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
    const bottomRef = useRef<HTMLDivElement>(null)

    const pubkey = useMemo(() => {
      if (!npub) return undefined
      try {
        const { type, data } = nip19.decode(npub)
        if (type === 'npub') return data
        if (type === 'nprofile') return data.pubkey
      } catch {
        return undefined
      }
    }, [npub])

    // Subscribe to the Pulse list's aggregation store for this user so events
    // its backfill turns up while we're on this page show here too.
    useEffect(() => {
      if (!feedId || !pubkey) {
        setServiceEvents([])
        return
      }

      const updateEvents = () => {
        const events = userAggregationService.getAggregation(feedId, pubkey) || []
        setServiceEvents(events)
      }

      const updateBackfill = () => {
        setIsPulseBackfilling(userAggregationService.isBackfilling(feedId))
      }

      const unSubAgg = userAggregationService.subscribeAggregationChange(feedId, pubkey, () => {
        updateEvents()
      })

      const unSubBackfill = userAggregationService.subscribeBackfillChange(feedId, () => {
        updateBackfill()
      })

      updateEvents()
      updateBackfill()

      return () => {
        unSubAgg()
        unSubBackfill()
      }
    }, [feedId, pubkey])

    // Persist this author's events into the Pulse IDB cache so a subsequent
    // visit to the Pulse list shows them instantly (instead of an empty row).
    // Also bumps the per-author meta so the Pulse backfill planner skips
    // overlapping fetches next session.
    const persistPulseEvents = useCallback((events: NostrEvent[], authorPubkey: string) => {
      const owned = events.filter((e) => e.pubkey === authorPubkey)
      if (owned.length === 0) return
      const items = owned.map((event) => ({
        event,
        relays: client.getEventHints(event.id)
      }))
      indexedDb.putPulseEvents(items, PULSE_EVENTS_PER_USER_CAP).catch(() => {
        // IDB errors are non-fatal — the UI already has the events in state.
      })
      indexedDb
        .putPulseAuthorMeta([
          {
            pubkey: authorPubkey,
            lastCheckedAt: Math.floor(Date.now() / 1000),
            lastCheckOk: true
          }
        ])
        .catch(() => {})
    }, [])

    // Long-lived subscription against the author's write relays + defaults.
    // Streaming (not one-shot) so slow relays still deliver events instead
    // of timing out into an empty result, which was the regression here.
    useEffect(() => {
      if (!pubkey) {
        setLiveEvents([])
        setIsInitialLoading(false)
        return
      }

      let cancelled = false
      let closer: (() => void) | undefined

      setIsInitialLoading(true)
      setLiveEvents([])
      setHasMore(true)
      setTimelineKey(undefined)

      const init = async () => {
        const relayList = await client.fetchRelayList(pubkey)
        if (cancelled) return
        const relays = relayList.write.concat(getDefaultRelayUrls()).slice(0, 8)

        const feedKinds = feedId
          ? userAggregationService.getFeedKinds(feedId)
          : undefined
        const filter: TSubRequestFilter =
          feedKinds && feedKinds.length > 0
            ? { authors: [pubkey], kinds: feedKinds, limit: FETCH_LIMIT }
            : { authors: [pubkey], limit: FETCH_LIMIT }

        const { closer: _closer, timelineKey: _key } = await client.subscribeTimeline(
          [{ urls: relays, filter }],
          {
            onEvents: (events, eosed) => {
              if (cancelled) return
              if (events.length > 0) {
                setLiveEvents(events)
                persistPulseEvents(events, pubkey)
              }
              if (eosed) {
                setIsInitialLoading(false)
              }
            },
            onNew: (event) => {
              if (cancelled) return
              setLiveEvents((prev) => mergeTimelines([[event], prev]))
              persistPulseEvents([event], pubkey)
            }
          },
          { needSort: true }
        )

        if (cancelled) {
          _closer()
          return
        }
        closer = _closer
        setTimelineKey(_key)
      }

      init().catch(() => {
        if (!cancelled) setIsInitialLoading(false)
      })

      return () => {
        cancelled = true
        if (closer) closer()
      }
    }, [pubkey, persistPulseEvents])

    // Merge service + subscription events, deduplicated, newest first.
    const allEvents = useMemo(() => {
      const combined = [...serviceEvents, ...liveEvents]
      const seen = new Set<string>()
      const deduped = combined.filter((e) => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })
      return deduped.sort((a, b) => b.created_at - a.created_at)
    }, [serviceEvents, liveEvents])

    // Fetch the next older batch via the existing timeline.
    const fetchMore = useCallback(async () => {
      if (!pubkey || !timelineKey || isLoadingMore || !hasMore) return
      setIsLoadingMore(true)
      try {
        const until = allEvents.length
          ? allEvents[allEvents.length - 1].created_at - 1
          : Math.floor(Date.now() / 1000)
        const olderEvents = await client.loadMoreTimeline(timelineKey, until, FETCH_LIMIT)
        if (olderEvents.length === 0) {
          setHasMore(false)
        } else {
          setLiveEvents((prev) => mergeTimelines([prev, olderEvents]))
          persistPulseEvents(olderEvents, pubkey)
        }
      } catch {
        // Network blip — leave hasMore true so the user can retry by scrolling
      } finally {
        setIsLoadingMore(false)
      }
    }, [pubkey, timelineKey, isLoadingMore, hasMore, allEvents, persistPulseEvents])

    // Infinite-scroll observer
    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            fetchMore()
          }
        },
        { rootMargin: '400px', threshold: 0 }
      )

      const el = bottomRef.current
      if (el) observer.observe(el)
      return () => {
        if (el) observer.unobserve(el)
      }
    }, [fetchMore])

    const isLoading = isPulseBackfilling || isInitialLoading || isLoadingMore

    if (!pubkey || !feedId) {
      return (
        <SecondaryPageLayout ref={ref} index={index} title={t('User Posts')}>
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            {t('Invalid user')}
          </div>
        </SecondaryPageLayout>
      )
    }

    return (
      <SecondaryPageLayout
        ref={ref}
        index={index}
        title={<SimpleUsername userId={pubkey} className="truncate" />}
        displayScrollToTopButton
      >
        <div className="min-h-screen">
          {allEvents.map((event) => (
            <NoteCard key={event.id} className="w-full" event={event} filterMutedNotes={false} />
          ))}

          <div ref={bottomRef} className="py-4">
            {isLoading ? (
              <div className="text-center text-sm text-muted-foreground">
                {t('loading more notes')}
              </div>
            ) : hasMore ? (
              // Sentinel — observer triggers fetchMore when this comes into view
              <div className="text-center text-sm text-muted-foreground">
                {t('loading more notes')}
              </div>
            ) : allEvents.length > 0 ? (
              <div className="text-center text-sm text-muted-foreground">
                {t('no more notes')}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                {t('no more notes')}
              </div>
            )}
          </div>
        </div>
      </SecondaryPageLayout>
    )
  }
)

UserAggregationDetailPage.displayName = 'UserAggregationDetailPage'

export default UserAggregationDetailPage

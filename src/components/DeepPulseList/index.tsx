import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar, { SimpleUserAvatar, UserAvatarSkeleton } from '@/components/UserAvatar'
import Username, { SimpleUsername } from '@/components/Username'
import { isMentioningMutedUsers } from '@/lib/event'
import { toNote, toUserAggregationDetail } from '@/lib/link'
import { getDefaultRelayUrls } from '@/lib/relay'
import { mergeTimelines } from '@/lib/timeline'
import { cn, isTouchDevice } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import { usePinnedUsers } from '@/providers/PinnedUsersProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import threadService from '@/services/thread.service'
import userAggregationService, { TUserAggregation } from '@/services/user-aggregation.service'
import { TFeedSubRequest } from '@/types'
import dayjs from 'dayjs'
import { History, Loader, Star } from 'lucide-react'
import { Event, Filter, kinds } from 'nostr-tools'
import { planBackfillRound } from '../UserAggregationList/pulse-backfill'
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
import NewNotesButton from '../NewNotesButton'
import TrustScoreBadge from '../TrustScoreBadge'

const LIMIT = 500
const SHOW_COUNT = 20
// Target number of events to show per user in the Pulse feed.
const PULSE_EVENTS_PER_USER_CAP = 10
// Cap on how many per-author backfill rounds we run after the initial EOSE.
const MAX_BACKFILL_ROUNDS = 2
// Max concurrent backfill REQs in flight. Low on purpose — browsers cap
// WebSocket connections and relays (damus, nos.lol, etc.) cap concurrent
// REQs per client. Going higher triggers "too many concurrent REQs" NOTICEs
// and "Insufficient resources" WS failures.
const BACKFILL_CONCURRENCY = 6
// When batching fresh-author queries into per-relay REQs, cap authors per
// REQ so relays don't reject filter-too-large.
const AUTHORS_PER_BATCHED_REQ = 50
// Buckets `since` values into 1-hour windows so we can coalesce authors
// checked "around the same time" into a single REQ. The REQ uses the
// minimum since in the bucket — worst case we get a few extra events.
const SINCE_BUCKET_SECONDS = 3600

export type TDeepPulseListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  refresh: () => void
}

const DeepPulseList = forwardRef<
  TDeepPulseListRef,
  {
    subRequests: TFeedSubRequest[]
    showKinds?: number[]
    filterMutedNotes?: boolean
    areAlgoRelays?: boolean
    showRelayCloseReason?: boolean
    isPubkeyFeed?: boolean
    trustScoreThreshold?: number
  }
>(
  (
    {
      subRequests,
      showKinds,
      filterMutedNotes = true,
      areAlgoRelays = false,
      showRelayCloseReason = false,
      isPubkeyFeed = false,
      trustScoreThreshold
    },
    ref
  ) => {
    const { t } = useTranslation()
    const active = usePageActive()
    const { pubkey: currentPubkey, startLogin } = useNostr()
    const { push } = useSecondaryPage()
    const { mutePubkeySet } = useMuteList()
    const { pinnedPubkeySet } = usePinnedUsers()
    const { meetsMinTrustScore } = useUserTrust()
    const { hideContentMentioningMutedUsers } = useContentPolicy()
    const { isEventDeleted } = useDeletedEvent()
    // `since` is no longer a hard time-window filter. It only tracks the
    // oldest timestamp we've loaded so we can show a "Last X days" hint.
    // The initial guess is 24h ago; it gets pushed backward as backfill
    // loads older events per-user.
    const [since, setSince] = useState(() => dayjs().subtract(1, 'day').unix())
    const [storedEvents, setStoredEvents] = useState<Event[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
    const [newEvents, setNewEvents] = useState<Event[]>([])
    const [filteredNewEvents, setFilteredNewEvents] = useState<Event[]>([])
    const [newEventPubkeys, setNewEventPubkeys] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const [backfilling, setBackfilling] = useState(false)
    const [backfillExhausted, setBackfillExhausted] = useState(false)
    const [showLoadingBar, setShowLoadingBar] = useState(true)
    const [refreshCount, setRefreshCount] = useState(0)
    const [showCount, setShowCount] = useState(SHOW_COUNT)
    // Track pubkeys that still need backfill and the per-author floor we've
    // already queried, so "Load earlier" can keep going without re-querying.
    const backfillFloorRef = useRef<Map<string, number>>(new Map())
    // Authors whose own write relays we've already queried without finding
    // anything. Used to avoid re-issuing per-author fresh queries each round.
    const freshTriedRef = useRef<Set<string>>(new Set())
    // Per-author `lastCheckedAt` loaded from IDB at mount. The planner uses
    // this to send `since: lastCheckedAt` instead of an unbounded fetch for
    // authors we've successfully checked before. Populated by the hydration
    // effect; updated in-memory after each successful per-author query so
    // subsequent rounds in the same session don't ask for overlapping ranges.
    const sinceByAuthorRef = useRef<Map<string, number>>(new Map())
    const supportTouch = useMemo(() => isTouchDevice(), [])
    const feedId = useMemo(() => {
      return userAggregationService.getFeedId(subRequests, showKinds)
    }, [JSON.stringify(subRequests), JSON.stringify(showKinds)])
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const topRef = useRef<HTMLDivElement | null>(null)
    const nonPinnedTopRef = useRef<HTMLDivElement | null>(null)
    const sinceRef = useRef<number | undefined>(undefined)
    sinceRef.current = newEvents.length
      ? newEvents[0].created_at + 1
      : events.length
        ? events[0].created_at + 1
        : undefined

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
      return () => {
        userAggregationService.clearAggregations(feedId)
      }
    }, [feedId])

    useEffect(() => {
      if (!subRequests.length) return

      sinceRef.current = undefined
      setSince(dayjs().subtract(1, 'day').unix())
      setStoredEvents([])
      setEvents([])
      setNewEvents([])
      setBackfilling(false)
      setBackfillExhausted(false)
      backfillFloorRef.current = new Map()
      freshTriedRef.current = new Set()
      sinceByAuthorRef.current = new Map()

      // Instant hydration from the Pulse IDB cache so inactive follows show
      // their last known posts while the live subscription catches up.
      // Cody's point: browser WS limits make live fetching of hundreds of
      // follows fragile; the cache bridges the gap for older posts.
      //
      // Also load per-author metadata (lastCheckedAt) so the backfill sends
      // `since: lastCheckedAt` instead of refetching the whole timeline.
      let cancelled = false
      const authors = subRequests.flatMap(({ filter }) => filter.authors ?? [])
      if (authors.length > 0) {
        // Hydrate events and meta independently. If one call fails (e.g. the
        // meta store doesn't exist yet on an in-progress schema upgrade),
        // the other still succeeds — the UI at least paints from cache.
        indexedDb
          .getPulseEventsForAuthors(authors, PULSE_EVENTS_PER_USER_CAP)
          .then((cached) => {
            if (cancelled || cached.length === 0) return
            const sorted = [...cached].sort(
              (a, b) => b.created_at - a.created_at
            )
            setEvents((prev) => mergeTimelines([sorted, prev]))
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[Pulse] event cache hydration failed:', err)
          })

        indexedDb
          .getPulseAuthorMeta(authors)
          .then((meta) => {
            if (cancelled) return
            for (const [pubkey, m] of meta) {
              if (m.lastCheckOk && m.lastCheckedAt > 0) {
                sinceByAuthorRef.current.set(pubkey, m.lastCheckedAt)
              }
            }
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[Pulse] author meta hydration failed:', err)
          })
      }
      return () => {
        cancelled = true
      }
    }, [feedId, refreshCount])

    // Per-author backfill: after the initial EOSE, fetch older events for
    // authors with fewer than PULSE_EVENTS_PER_USER_CAP events. The actual
    // query planning lives in pulse-backfill.ts so it can be unit-tested;
    // this function handles execution, state wiring and floor bookkeeping.
    const runBackfill = useCallback(
      async (seedEvents: Event[], deeper = false) => {
        const allAuthors = new Set(
          subRequests.flatMap(({ filter }) => filter.authors ?? [])
        )
        if (allAuthors.size === 0) return

        setBackfilling(true)
        userAggregationService.setBackfilling(feedId, true)
        setBackfillExhausted(false)
        try {
          let accumulated = seedEvents
          let totalFetched = 0

          for (let round = 0; round < MAX_BACKFILL_ROUNDS; round++) {
            const plan = planBackfillRound({
              subRequests,
              showKinds: showKinds ?? [],
              accumulated,
              perUserCap: PULSE_EVENTS_PER_USER_CAP,
              floors: backfillFloorRef.current,
              freshTried: freshTriedRef.current,
              sinceByAuthor: sinceByAuthorRef.current,
              deeper,
              freshLimit: 1000,
              partialLimit: PULSE_EVENTS_PER_USER_CAP
            })
            if (plan.queries.length === 0) break

            // Resolve relays per query. Fetch relay lists in parallel so
            // hundreds of authors don't serialize one fetchRelayList at a
            // time (IDB-cached internally, but still worth batching).
            const resolved = await Promise.all(
              plan.queries.map(async (q) => {
                if ((q.kind === 'partial' || q.kind === 'fresh-author') && q.pubkey) {
                  const relayList = await client.fetchRelayList(q.pubkey)
                  const merged = Array.from(
                    new Set([
                      ...q.urls,
                      ...relayList.write,
                      ...getDefaultRelayUrls()
                    ])
                  ).slice(0, 8)
                  return { ...q, urls: merged }
                }
                const urls = q.urls.length
                  ? q.urls
                  : await client.determineRelaysByFilter(q.filter)
                return { ...q, urls }
              })
            )

            // Stream results into state as each query resolves so the UI
            // updates progressively instead of waiting for the whole round.
            const existingIds = new Set(accumulated.map((e) => e.id))
            let fetchedTotal = 0
            const commitEvents = (evts: Event[]) => {
              const fresh: Event[] = []
              for (const e of evts) {
                if (existingIds.has(e.id)) continue
                existingIds.add(e.id)
                fresh.push(e)
              }
              if (fresh.length === 0) return
              fetchedTotal += fresh.length
              accumulated = [...accumulated, ...fresh].sort(
                (a, b) => b.created_at - a.created_at
              )
              // CRITICAL: merge into current state (which includes the
              // IDB-hydrated events) rather than replacing it. Previously we
              // called setEvents(accumulated), which wiped the cache on the
              // first commit because `accumulated` only contained the fresh
              // subscription + backfill events, not the cached ones.
              setEvents((prev) => mergeTimelines([accumulated, prev]))
            }

            const freshQ = resolved.filter((q) => q.kind === 'fresh')
            const freshAuthorQ = resolved.filter((q) => q.kind === 'fresh-author')
            // Partial queries stay per-author: each one carries an
            // author-specific `until` that can't be coalesced with others.
            const partialQ = resolved
              .filter((q) => q.kind === 'partial')
              .sort((a, b) => {
                const aPinned = a.pubkey && pinnedPubkeySet.has(a.pubkey) ? 1 : 0
                const bPinned = b.pubkey && pinnedPubkeySet.has(b.pubkey) ? 1 : 0
                return bPinned - aPinned
              })

            // Coalesce fresh-author queries by (relay, since-bucket) into
            // a handful of per-relay multi-author REQs. Goes from N-author
            // * M-relay = N*M REQs (which blows browser WS caps and trips
            // relay "too many concurrent REQs" NOTICEs) down to R*B REQs
            // where R is the number of distinct relays targeted and B the
            // number of since-buckets — usually R*B < 50 even for 500
            // follows.
            type Batch = {
              relay: string
              since: number | undefined // actual since we send
              authors: string[] // full author list in this batch
              filterTemplate: Filter // kinds, limit, plus any extra filter fields from the subRequest
            }
            const batchMap = new Map<string, Batch>()
            const bucketSince = (since: number | undefined) =>
              since === undefined
                ? undefined
                : Math.floor(since / SINCE_BUCKET_SECONDS) * SINCE_BUCKET_SECONDS

            for (const q of freshAuthorQ) {
              if (!q.pubkey) continue
              const since = q.filter.since as number | undefined
              const bucket = bucketSince(since)
              // Strip single-author bits from the filter; we'll add authors
              // per batch. Keep kinds / limit / any extra fields.
              const { authors: _a, since: _s, ...rest } = q.filter
              for (const relay of q.urls) {
                const key = `${relay}|${bucket ?? 'none'}|${JSON.stringify(rest)}`
                let batch = batchMap.get(key)
                if (!batch) {
                  batch = {
                    relay,
                    since: bucket,
                    authors: [],
                    filterTemplate: rest
                  }
                  batchMap.set(key, batch)
                }
                if (!batch.authors.includes(q.pubkey)) {
                  batch.authors.push(q.pubkey)
                }
              }
            }

            // Split any batch whose author list exceeds AUTHORS_PER_BATCHED_REQ
            // so relays don't reject oversize filters.
            type FinalBatch = Batch & { id: string }
            const finalBatches: FinalBatch[] = []
            for (const batch of batchMap.values()) {
              // Prioritize Special Follows inside each batch so they get
              // into the first chunk when splits happen.
              const sorted = [...batch.authors].sort((a, b) => {
                const aP = pinnedPubkeySet.has(a) ? 1 : 0
                const bP = pinnedPubkeySet.has(b) ? 1 : 0
                return bP - aP
              })
              for (let i = 0; i < sorted.length; i += AUTHORS_PER_BATCHED_REQ) {
                const slice = sorted.slice(i, i + AUTHORS_PER_BATCHED_REQ)
                finalBatches.push({
                  ...batch,
                  authors: slice,
                  id: `${batch.relay}|${batch.since ?? 'none'}|${i}`
                })
              }
            }

            // Observability: count how many queries actually failed so we
            // can tell the user when things broke vs just returned empty.
            let failedCount = 0
            let okCount = 0

            // Unified task queue: grouped fresh + batched fresh-author +
            // per-author partial. All run through the same bounded pool
            // so total concurrent REQs stay under BACKFILL_CONCURRENCY.
            type Task = () => Promise<void>
            const checkedAt = Math.floor(Date.now() / 1000)
            const metaUpdates: {
              pubkey: string
              lastCheckedAt: number
              lastCheckOk: boolean
            }[] = []

            const tasks: Task[] = []

            // SUCCESS semantics (critical invariant — the cache is never
            // thrown away): on resolve, update cache + bump meta. On throw,
            // leave everything alone and let the next round/session retry.

            // Grouped fresh queries (few, large).
            for (const q of freshQ) {
              tasks.push(async () => {
                try {
                  const evts = await client.fetchEvents(q.urls, q.filter)
                  okCount++
                  commitEvents(evts)
                } catch {
                  failedCount++
                }
              })
            }

            // Batched fresh-author queries (per-relay, multi-author).
            for (const batch of finalBatches) {
              tasks.push(async () => {
                const filter: Filter = {
                  ...batch.filterTemplate,
                  authors: batch.authors
                }
                if (batch.since !== undefined) filter.since = batch.since
                try {
                  const evts = await client.fetchEvents([batch.relay], filter)
                  okCount++
                  commitEvents(evts)
                  // Mark ALL authors in the batch as successfully checked
                  // on this relay. (We don't track per-author-per-relay;
                  // once any relay responds for an author, they're "seen".)
                  if (evts.length > 0) {
                    const items = evts.map((evt) => ({
                      event: evt,
                      relays: client.getEventHints(evt.id)
                    }))
                    indexedDb
                      .putPulseEvents(items, PULSE_EVENTS_PER_USER_CAP)
                      .catch(() => {})
                  }
                  for (const pubkey of batch.authors) {
                    sinceByAuthorRef.current.set(pubkey, checkedAt)
                    metaUpdates.push({
                      pubkey,
                      lastCheckedAt: checkedAt,
                      lastCheckOk: true
                    })
                    freshTriedRef.current.add(pubkey)
                  }
                } catch {
                  failedCount++
                  // Leave cache + meta alone — next round retries.
                }
              })
            }

            // Per-author partial queries (author-specific `until`).
            for (const q of partialQ) {
              tasks.push(async () => {
                try {
                  const evts = await client.fetchEvents(q.urls, q.filter)
                  okCount++
                  commitEvents(evts)
                  if (q.pubkey) {
                    if (evts.length > 0) {
                      const items = evts.map((evt) => ({
                        event: evt,
                        relays: client.getEventHints(evt.id)
                      }))
                      indexedDb
                        .putPulseEvents(items, PULSE_EVENTS_PER_USER_CAP)
                        .catch(() => {})
                    }
                    sinceByAuthorRef.current.set(q.pubkey, checkedAt)
                    metaUpdates.push({
                      pubkey: q.pubkey,
                      lastCheckedAt: checkedAt,
                      lastCheckOk: true
                    })
                    const floor = (q.filter.until as number) ?? 0
                    const prev = backfillFloorRef.current.get(q.pubkey)
                    if (prev === undefined || floor < prev) {
                      backfillFloorRef.current.set(q.pubkey, floor)
                    }
                  }
                } catch {
                  failedCount++
                }
              })
            }

            // Bounded concurrency pool — keep concurrent REQs in flight
            // below both the browser's WS cap and typical relay REQ caps.
            let cursor = 0
            const runNext = async (): Promise<void> => {
              while (cursor < tasks.length) {
                const i = cursor++
                await tasks[i]()
              }
            }
            const workers: Promise<void>[] = []
            const poolSize = Math.min(BACKFILL_CONCURRENCY, tasks.length)
            for (let i = 0; i < poolSize; i++) workers.push(runNext())

            await Promise.allSettled(workers)

            // Durably persist the meta bumps for authors that were
            // successfully checked this round, so the next session knows
            // where to resume.
            if (metaUpdates.length > 0) {
              indexedDb.putPulseAuthorMeta(metaUpdates).catch(() => {
                // IDB errors are non-fatal.
              })
            }

            // Warn in console when a significant fraction of queries blew
            // up — usually it's the browser's WebSocket connection cap or
            // downed relays. Cheap observability, no toast spam.
            const totalQ = okCount + failedCount
            if (totalQ > 0 && failedCount / totalQ > 0.25) {
              // eslint-disable-next-line no-console
              console.warn(
                `[Pulse] backfill round: ${failedCount}/${totalQ} queries failed. ` +
                  'Browser WebSocket limit or relay outages are likely; ' +
                  'falling back to cache where available.'
              )
            }

            if (fetchedTotal === 0) break
            totalFetched += fetchedTotal
          }

          // Push the 'since' hint to the oldest event we now have.
          if (accumulated.length > 0) {
            const oldest = accumulated[accumulated.length - 1].created_at
            setSince((prev) => (oldest < prev ? oldest : prev))
          }

          if (totalFetched === 0) {
            setBackfillExhausted(true)
          }
          // NOTE: Events are now persisted per-author inside the worker on
          // successful checks; no bulk flush here. This keeps the cache
          // authoritative and ensures a timeout never wipes a user's cached
          // events.
        } finally {
          setBackfilling(false)
          userAggregationService.setBackfilling(feedId, false)
        }
      },
      [subRequests, showKinds, feedId]
    )

    useEffect(() => {
      if (!subRequests.length || !active) return

      async function init() {
        setLoading(true)
        userAggregationService.setBackfilling(feedId, true)

        if (showKinds?.length === 0 && subRequests.every(({ filter }) => !filter.kinds)) {
          setLoading(false)
          userAggregationService.setBackfilling(feedId, false)
          return () => {}
        }

        const since = sinceRef.current

        if (isPubkeyFeed) {
          const storedEvents = await client.getEventsFromIndexed({
            authors: subRequests.flatMap(({ filter }) => filter.authors ?? []),
            kinds: showKinds ?? [],
            since: dayjs().subtract(1, 'day').unix()
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
                limit: LIMIT
              }
            }
          })
        )

        const { closer } = await client.subscribeTimeline(
          preprocessedSubRequests,
          {
            onEvents: (events, eosed) => {
              if (events.length > 0) {
                if (!since) {
                  // Merge with whatever the IDB hydrator has put there,
                  // instead of overwriting it. `events` is already sorted
                  // desc by client.subscribeTimeline.
                  setEvents((prev) => mergeTimelines([events, prev]))
                } else {
                  const newEvents = events.filter((evt) => evt.created_at >= since)
                  setNewEvents((oldEvents) => mergeTimelines([newEvents, oldEvents]))
                }
              }
              if (eosed) {
                setLoading(false)
                threadService.addRepliesToThread(events)

                // Persist the initial grouped batch to the Pulse cache so
                // events found here survive across sessions. We do NOT bump
                // per-author meta from the grouped query — only per-author
                // checks can confidently assert "this author was checked at
                // time T" (the grouped query might have skipped an author
                // whose posts live on non-feed relays).
                if (events.length > 0) {
                  const items = events.map((evt) => ({
                    event: evt,
                    relays: client.getEventHints(evt.id)
                  }))
                  indexedDb
                    .putPulseEvents(items, PULSE_EVENTS_PER_USER_CAP)
                    .catch(() => {})
                }

                // After the initial batch lands, top each author up toward
                // PULSE_EVENTS_PER_USER_CAP. Algo relays skip this because
                // their event set isn't a per-author timeline.
                if (!areAlgoRelays) {
                  const hasAuthors = subRequests.some(
                    ({ filter }) => (filter.authors?.length ?? 0) > 0
                  )
                  if (hasAuthors) {
                    runBackfill(events)
                  } else {
                    userAggregationService.setBackfilling(feedId, false)
                  }
                } else {
                  userAggregationService.setBackfilling(feedId, false)
                }
              }
            },
            onNew: (event) => {
              setNewEvents((oldEvents) => mergeTimelines([[event], oldEvents]))
              threadService.addRepliesToThread([event])
              // Stream new events into the Pulse cache too so a subsequent
              // session shows them from cache instantly.
              indexedDb
                .putPulseEvents(
                  [{ event, relays: client.getEventHints(event.id) }],
                  PULSE_EVENTS_PER_USER_CAP
                )
                .catch(() => {})
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

        return closer
      }

      const promise = init()
      return () => {
        promise.then((closer) => closer())
      }
    }, [feedId, refreshCount, active])

    // "Load earlier" handler: we no longer reactively re-fetch as `since`
    // changes (that was a no-op here because we removed the time filter).
    // Instead, extending the timeline is triggered explicitly from the
    // button click handler below.

    useEffect(() => {
      if (loading) {
        setShowLoadingBar(true)
        return
      }

      const timeout = setTimeout(() => {
        setShowLoadingBar(false)
      }, 1000)

      return () => clearTimeout(timeout)
    }, [loading])

    const filterEvents = useCallback(
      async (events: Event[]) => {
        const results = await Promise.allSettled(
          events.map(async (evt) => {
            if (evt.pubkey === currentPubkey) return null
            // NOTE: we deliberately do NOT filter by `since` here.
            // Pulse shows up to N most recent events per user, unbounded
            // by time. `since` is only a UI hint for the header label.
            if (isEventDeleted(evt)) return null
            if (filterMutedNotes && mutePubkeySet.has(evt.pubkey)) return null
            if (
              filterMutedNotes &&
              hideContentMentioningMutedUsers &&
              isMentioningMutedUsers(evt, mutePubkeySet)
            ) {
              return null
            }
            if (
              trustScoreThreshold &&
              !(await meetsMinTrustScore(evt.pubkey, trustScoreThreshold))
            ) {
              return null
            }

            return evt
          })
        )
        return results
          .filter((res) => res.status === 'fulfilled' && res.value !== null)
          .map((res) => (res as PromiseFulfilledResult<Event>).value)
      },
      [
        mutePubkeySet,
        isEventDeleted,
        currentPubkey,
        filterMutedNotes,
        hideContentMentioningMutedUsers,
        isMentioningMutedUsers,
        meetsMinTrustScore,
        trustScoreThreshold
      ]
    )

    // Derive the label from the oldest event actually loaded (not the
    // `since` state, which is just a floor hint).
    const oldestLoadedTs = useMemo(() => {
      if (events.length === 0) return since
      return events[events.length - 1].created_at
    }, [events, since])

    const lastXDays = useMemo(() => {
      return Math.max(0, dayjs().diff(dayjs.unix(oldestLoadedTs), 'day'))
    }, [oldestLoadedTs])

    useEffect(() => {
      const mergedEvents = mergeTimelines([events, storedEvents])
      filterEvents(mergedEvents).then((filtered) => {
        setFilteredEvents(filtered)
      })
    }, [events, storedEvents, filterEvents])

    useEffect(() => {
      filterEvents(newEvents).then((filtered) => {
        setFilteredNewEvents(filtered)
      })
    }, [newEvents, filterEvents])

    const allAuthors = useMemo(() => {
      // Exclude the current user so the Pulse list and the filterEvents()
      // pass agree: we already skip the user's own events in filterEvents,
      // so keeping them in the padded follow list would show them forever
      // as a zero-event "No posts found" row.
      const set = new Set(subRequests.flatMap(({ filter }) => filter.authors ?? []))
      if (currentPubkey) set.delete(currentPubkey)
      return set
    }, [JSON.stringify(subRequests), currentPubkey])

    const fullAggregations = useMemo(() => {
      const aggs = userAggregationService.aggregateByUser(filteredEvents)
      // Pad with zero-event follows so every follow is visible. This lets
      // the user spot inactive / no-profile follows they might want to prune.
      const existing = new Set(aggs.map((a) => a.pubkey))
      for (const pubkey of allAuthors) {
        if (existing.has(pubkey)) continue
        aggs.push({
          pubkey,
          events: [],
          count: 0,
          lastEventTime: 0
        })
      }
      return aggs
    }, [filteredEvents, allAuthors])

    // Persist aggregations in an effect, not inside useMemo. saveAggregations
    // synchronously notifies subscribers (UserAggregationDetailPage), which
    // would then setState during DeepPulseList's render and trigger the
    // React warning: "Cannot update a component while rendering a different
    // component". Running it in useEffect defers the notify to after commit.
    useEffect(() => {
      userAggregationService.saveAggregations(feedId, fullAggregations)
    }, [feedId, fullAggregations])

    const aggregations = useMemo(() => {
      // Cap each user's events to the most-recent N for the list view.
      // The detail page reads the full uncapped set from the service.
      return fullAggregations.map((agg) => {
        const sorted = [...agg.events].sort((a, b) => b.created_at - a.created_at)
        const top = sorted.slice(0, PULSE_EVENTS_PER_USER_CAP)
        return {
          ...agg,
          events: top,
          count: top.length,
          lastEventTime: top.length > 0 ? top[0].created_at : agg.lastEventTime
        }
      })
    }, [fullAggregations])

    const pinnedAggregations = useMemo(() => {
      return aggregations.filter((agg) => pinnedPubkeySet.has(agg.pubkey))
    }, [aggregations, pinnedPubkeySet])

    const normalAggregations = useMemo(() => {
      return aggregations.filter((agg) => !pinnedPubkeySet.has(agg.pubkey))
    }, [aggregations, pinnedPubkeySet])

    const displayedNormalAggregations = useMemo(() => {
      return normalAggregations.slice(0, showCount)
    }, [normalAggregations, showCount])

    const hasMoreToDisplay = useMemo(() => {
      return normalAggregations.length > displayedNormalAggregations.length
    }, [normalAggregations, displayedNormalAggregations])

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '600px',
        threshold: 0
      }
      const observerInstance = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return
        if (hasMoreToDisplay) {
          // Reveal more already-aggregated users first (cheap).
          setShowCount((count) => count + SHOW_COUNT)
        } else if (!loading && !backfilling && !backfillExhausted) {
          // We've shown everyone we have; try to find more events
          // further back for the users who aren't fully topped up.
          runBackfill(events, true)
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
    }, [hasMoreToDisplay, loading, backfilling, backfillExhausted, events, runBackfill])

    const handleViewUser = (agg: TUserAggregation) => {
      // Mark as viewed when user clicks
      userAggregationService.markAsViewed(feedId, agg.pubkey)
      setNewEventPubkeys((prev) => {
        const newSet = new Set(prev)
        newSet.delete(agg.pubkey)
        return newSet
      })

      if (agg.count === 1) {
        const evt = agg.events[0]
        if (evt.kind !== kinds.Repost && evt.kind !== kinds.GenericRepost) {
          push(toNote(agg.events[0]))
          return
        }
      }

      push(toUserAggregationDetail(feedId, agg.pubkey))
    }

    const handleLoadEarlier = () => {
      setShowCount(SHOW_COUNT)
      // Run another backfill pass. `deeper=true` re-queries authors whose
      // floor we've already hit, pushing further into the past.
      runBackfill(events, true)
    }

    const showNewEvents = () => {
      const pubkeySet = new Set<string>()
      let hasPinnedUser = false
      newEvents.forEach((evt) => {
        pubkeySet.add(evt.pubkey)
        if (pinnedPubkeySet.has(evt.pubkey)) {
          hasPinnedUser = true
        }
      })
      setNewEventPubkeys(pubkeySet)
      setEvents((oldEvents) => [...newEvents, ...oldEvents])
      setNewEvents([])
      setTimeout(() => {
        if (hasPinnedUser) {
          scrollToTop('smooth')
          return
        }
        nonPinnedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    }

    const list = (
      <div className="min-h-screen">
        {pinnedAggregations.map((agg) => (
          <UserAggregationItem
            key={agg.pubkey}
            feedId={feedId}
            aggregation={agg}
            onClick={() => handleViewUser(agg)}
            isNew={newEventPubkeys.has(agg.pubkey)}
          />
        ))}

        <div ref={nonPinnedTopRef} className="scroll-mt-[calc(6rem+1px)]" />
        {normalAggregations.map((agg) => (
          <UserAggregationItem
            key={agg.pubkey}
            feedId={feedId}
            aggregation={agg}
            onClick={() => handleViewUser(agg)}
            isNew={newEventPubkeys.has(agg.pubkey)}
          />
        ))}

        {loading || backfilling || hasMoreToDisplay || !backfillExhausted ? (
          <div ref={bottomRef}>
            <UserAggregationItemSkeleton />
          </div>
        ) : aggregations.length === 0 ? (
          <div className="mt-2 flex w-full justify-center">
            <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
              {t('Reload')}
            </Button>
          </div>
        ) : (
          <div className="mt-2 text-center text-sm text-muted-foreground">{t('no more notes')}</div>
        )}
      </div>
    )

    return (
      <div>
        <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
        {showLoadingBar && <LoadingBar />}
        <div className="flex h-12 items-center justify-between gap-2 border-b pl-4 pr-1">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {lastXDays === 1
                ? t('Last 24 hours')
                : t('Last {{count}} days', { count: lastXDays })}
            </span>
            ·
            <span>
              {filteredEvents.length} {t('notes')}
            </span>
          </div>
          <Button
            variant="ghost"
            className="h-10 shrink-0 rounded-lg px-3 text-muted-foreground hover:text-foreground"
            disabled={loading || backfilling}
            onClick={handleLoadEarlier}
          >
            {loading || backfilling ? (
              <Loader className="animate-spin" />
            ) : (
              <History />
            )}
            {t('Load earlier')}
          </Button>
        </div>
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
DeepPulseList.displayName = 'DeepPulseList'
export default DeepPulseList

function UserAggregationItem({
  feedId,
  aggregation,
  onClick,
  isNew
}: {
  feedId: string
  aggregation: TUserAggregation
  onClick: () => void
  isNew?: boolean
}) {
  const { t } = useTranslation()
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const [hasNewEvents, setHasNewEvents] = useState(true)
  const [loading, setLoading] = useState(false)
  const [feedBackfilling, setFeedBackfilling] = useState(false)
  const { isPinned, togglePin } = usePinnedUsers()
  const pinned = useMemo(() => isPinned(aggregation.pubkey), [aggregation.pubkey, isPinned])

  useEffect(() => {
    const update = () => {
      const lastViewedTime = userAggregationService.getLastViewedTime(feedId, aggregation.pubkey)
      setHasNewEvents(aggregation.lastEventTime > lastViewedTime)
    }

    const unSub = userAggregationService.subscribeViewedTimeChange(
      feedId,
      aggregation.pubkey,
      () => {
        update()
      }
    )

    update()

    return unSub
  }, [feedId, aggregation])

  useEffect(() => {
    const update = () => {
      setFeedBackfilling(userAggregationService.isBackfilling(feedId))
    }
    const unSub = userAggregationService.subscribeBackfillChange(feedId, update)
    update()
    return unSub
  }, [feedId])

  const onTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading(true)
    togglePin(aggregation.pubkey).finally(() => {
      setLoading(false)
    })
  }

  const onToggleViewed = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasNewEvents) {
      userAggregationService.markAsViewed(feedId, aggregation.pubkey)
    } else {
      userAggregationService.markAsUnviewed(feedId, aggregation.pubkey)
    }
  }

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-center gap-4 border-b px-4 py-3 transition-all duration-200 hover:bg-accent/30',
        isNew && 'bg-primary/15 hover:bg-primary/20'
      )}
      onClick={onClick}
    >
      {supportTouch ? (
        <SimpleUserAvatar
          userId={aggregation.pubkey}
          className={!hasNewEvents ? 'grayscale' : ''}
        />
      ) : (
        <UserAvatar userId={aggregation.pubkey} className={!hasNewEvents ? 'grayscale' : ''} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          {supportTouch ? (
            <SimpleUsername
              userId={aggregation.pubkey}
              className={cn(
                'max-w-fit truncate text-base font-semibold',
                !hasNewEvents && 'text-muted-foreground'
              )}
              skeletonClassName="h-4"
            />
          ) : (
            <Username
              userId={aggregation.pubkey}
              className={cn(
                'max-w-fit truncate text-base font-semibold',
                !hasNewEvents && 'text-muted-foreground'
              )}
              skeletonClassName="h-4"
            />
          )}
          <TrustScoreBadge pubkey={aggregation.pubkey} />
        </div>
        {aggregation.lastEventTime > 0 ? (
          <FormattedTimestamp
            timestamp={aggregation.lastEventTime}
            className="text-sm text-muted-foreground"
          />
        ) : feedBackfilling ? (
          <span className="text-sm text-muted-foreground italic">{t('Checking...')}</span>
        ) : (
          <span className="text-sm text-muted-foreground">{t('No posts found')}</span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onTogglePin}
        className={`shrink-0 ${
          pinned
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title={pinned ? t('Unfollow Special') : t('Special Follow')}
      >
        {loading ? (
          <Loader className="animate-spin" />
        ) : (
          <Star className={pinned ? 'fill-primary stroke-primary' : ''} />
        )}
      </Button>

      {/*
        New-events indicator. The count is deliberately not shown because
        per-user events are capped at PULSE_EVENTS_PER_USER_CAP for display,
        so it would always read 0 or the cap — no signal. A filled dot means
        "new activity since last viewed"; click to mark viewed/unviewed.
      */}
      {aggregation.count > 0 && (
        <button
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
            hasNewEvents
              ? 'bg-primary hover:bg-primary/80'
              : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
          )}
          onClick={onToggleViewed}
          title={hasNewEvents ? t('Mark as viewed') : t('Mark as unviewed')}
          aria-label={hasNewEvents ? t('Mark as viewed') : t('Mark as unviewed')}
        />
      )}
    </div>
  )
}

function UserAggregationItemSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <UserAvatarSkeleton className="size-10" />
      <div className="flex-1">
        <Skeleton className="my-1 h-4 w-36" />
        <Skeleton className="my-1 h-3 w-14" />
      </div>
      <UserAvatarSkeleton className="size-10" />
    </div>
  )
}

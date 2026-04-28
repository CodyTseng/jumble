import NoteCard from '@/components/NoteCard'
import { SimpleUsername } from '@/components/Username'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getDefaultRelayUrls } from '@/lib/relay'
import client from '@/services/client.service'
import userAggregationService from '@/services/user-aggregation.service'
import { nip19, NostrEvent } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// We deliberately do NOT constrain to a kinds subset here — matching the
// ProfilePage behaviour so every renderable event from this author shows.
// Hardcoding a kinds list caused false "No posts found" when a user only
// posted kinds outside that list.
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
    const [localEvents, setLocalEvents] = useState<NostrEvent[]>([])
    const [isPulseBackfilling, setIsPulseBackfilling] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const bottomRef = useRef<HTMLDivElement>(null)

    // Mutable state ref so the intersection-observer callback never goes stale.
    const stateRef = useRef({
      pubkey: undefined as string | undefined,
      feedId: undefined as string | undefined,
      until: undefined as number | undefined,
      isLoadingMore: false,
      hasMore: true
    })

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

    // Sync ref with current props / state
    useEffect(() => { stateRef.current.pubkey = pubkey }, [pubkey])
    useEffect(() => { stateRef.current.feedId = feedId }, [feedId])
    useEffect(() => { stateRef.current.isLoadingMore = isLoadingMore }, [isLoadingMore])
    useEffect(() => { stateRef.current.hasMore = hasMore }, [hasMore])

    // Subscribe to the Pulse list's aggregation store for this user
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

    // Initialise the pagination cursor from the oldest service event.
    // Once set we never move it backward here — local fetches drive it
    // further into the past.
    useEffect(() => {
      if (serviceEvents.length > 0 && stateRef.current.until === undefined) {
        const oldest = [...serviceEvents].sort((a, b) => a.created_at - b.created_at)[0]
        if (oldest) {
          stateRef.current.until = oldest.created_at - 1
        }
      }
    }, [serviceEvents])

    // Fetch the next older batch for this user.
    const fetchMore = useCallback(async () => {
      const { pubkey, until, isLoadingMore, hasMore } = stateRef.current
      if (!pubkey || isLoadingMore || !hasMore) return

      setIsLoadingMore(true)
      stateRef.current.isLoadingMore = true

      try {
        // Use the author's NIP-65 write relays AND include the default relay
        // set, capped at 8 — same strategy as the ProfilePage. Relying only
        // on write relays misses posts when the author has a stale or empty
        // relay list; defaults fill the gap for popular users.
        const relayList = await client.fetchRelayList(pubkey)
        const relays = relayList.write.concat(getDefaultRelayUrls()).slice(0, 8)
        const filter = {
          authors: [pubkey],
          limit: FETCH_LIMIT,
          ...(until !== undefined ? { until } : {})
        }

        const events = await client.fetchEvents(relays, filter)

        if (events.length === 0) {
          setHasMore(false)
          stateRef.current.hasMore = false
        } else {
          const oldest = [...events].sort((a, b) => a.created_at - b.created_at)[0]
          if (oldest) {
            stateRef.current.until = oldest.created_at - 1
          }
          setLocalEvents((prev) => [...prev, ...events])
        }
      } catch {
        // Network blip — leave hasMore true so the user can retry by scrolling
      } finally {
        setIsLoadingMore(false)
        stateRef.current.isLoadingMore = false
      }
    }, [])

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

    // Merge service + locally fetched events, deduplicated, newest first.
    const allEvents = useMemo(() => {
      const combined = [...serviceEvents, ...localEvents]
      const seen = new Set<string>()
      const deduped = combined.filter((e) => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })
      return deduped.sort((a, b) => b.created_at - a.created_at)
    }, [serviceEvents, localEvents])

    const isLoading = isPulseBackfilling || isLoadingMore

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
            ) : null}
          </div>
        </div>
      </SecondaryPageLayout>
    )
  }
)

UserAggregationDetailPage.displayName = 'UserAggregationDetailPage'

export default UserAggregationDetailPage

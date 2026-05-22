import { useSecondaryPage } from '@/PageManager'
import ContentPreview from '@/components/ContentPreview'
import Note from '@/components/Note'
import NoteInteractions from '@/components/NoteInteractions'
import StuffStats from '@/components/StuffStats'
import { Button } from '@/components/ui/button'
import UserAvatar, { UserAvatarSkeleton } from '@/components/UserAvatar'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ExtendedKind } from '@/constants'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import {
  getEventKey,
  getKeyFromTag,
  getParentBech32Id,
  getParentTag,
  getRootBech32Id
} from '@/lib/event'
import { toExternalContent, toNote } from '@/lib/link'
import { getDefaultRelayUrls } from '@/lib/relay'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import client from '@/services/client.service'
import { Ellipsis } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from './NotFound'

// Each click of "Show more context" reveals this many additional ancestors.
const STEP = 10
// Matches the focused container's `scroll-mt-14` (3.5rem ≈ 56px) so that
// scrollIntoView({ block: 'start' }) doesn't tuck the note under the titlebar.
const TITLEBAR_OFFSET_PX = 56

const NotePage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(id)
  const focusedRef = useRef<HTMLDivElement>(null)
  const repositionedRef = useRef(false)
  // Bech32 ids of ancestors prefetched so far, ordered [parent, grandparent, ...].
  // Each is already in `client`'s in-memory cache so revealing renders without
  // a round-trip.
  const [chain, setChain] = useState<string[]>([])
  // Prefetch reached either an event with no parent tag or an unreachable one.
  const [prefetchDone, setPrefetchDone] = useState(false)
  // The deepest entry in `chain` is the actual root (vs. the walk bailing out
  // early on an unfetchable ancestor).
  const [chainReachedRoot, setChainReachedRoot] = useState(false)
  // Count of ancestors rendered as full Notes above the focused note.
  const [revealed, setRevealed] = useState(0)
  // Tracks which focused event the prefetch/reveal state belongs to, so a
  // navigation to a different note resets state during render rather than
  // in an effect — otherwise the first paint with the new event would use
  // the previous note's `chain`/`revealed`, briefly hiding the parent pill.
  const [trackedEventId, setTrackedEventId] = useState<string | undefined>(undefined)

  const parentEventId = useMemo(() => getParentBech32Id(event), [event])
  const rootEventId = useMemo(() => getRootBech32Id(event), [event])
  const rootITag = useMemo(
    () => (event?.kind === ExtendedKind.COMMENT ? event.tags.find(tagNameEquals('I')) : undefined),
    [event]
  )
  const { isFetching: isFetchingRootEvent, event: rootEvent } = useFetchEvent(rootEventId)
  const { isFetching: isFetchingParentEvent, event: parentEvent } = useFetchEvent(parentEventId)

  if (event?.id !== trackedEventId) {
    setTrackedEventId(event?.id)
    setChain([])
    setPrefetchDone(false)
    setChainReachedRoot(false)
    setRevealed(0)
    repositionedRef.current = false
  }

  // Background prefetch: walk up the ancestor chain so each Show-more click
  // renders from cache. Gated on the parent and root pills' own
  // `useFetchEvent` fetches having settled — that way they fill in
  // uncontested, and the walk (which adds N extra relay roundtrips for a
  // chain of depth N) only kicks in once the immediately-visible pills are
  // already done.
  const pillsSettled = !isFetchingParentEvent && !isFetchingRootEvent
  useEffect(() => {
    if (!event?.id || !parentEventId || !pillsSettled) return
    let cancelled = false

    void (async () => {
      let currentId: string | undefined = parentEventId
      const accumulated: string[] = []
      while (currentId && !cancelled) {
        try {
          const fetched = await client.fetchEvent(currentId)
          if (cancelled) return
          if (!fetched) break
          accumulated.push(currentId)
          setChain([...accumulated])

          const nextId = getParentBech32Id(fetched)
          if (!nextId) {
            if (!cancelled) setChainReachedRoot(true)
            break
          }
          currentId = nextId
        } catch {
          break
        }
      }
      if (!cancelled) setPrefetchDone(true)
    })()

    return () => {
      cancelled = true
    }
  }, [event?.id, parentEventId, pillsSettled])

  // Author-batched prefetch: once we know the conversation's 1–3
  // participants (focused / parent / root authors), one REQ for their notes
  // that reference the same root usually catches the entire ancestor chain
  // — e.g. an Alice ↔ Bob back-and-forth on Carol's root. Cached results
  // make the chain walk above mostly serve hits instead of paying a round
  // trip per ancestor.
  useEffect(() => {
    if (!event?.id || !pillsSettled || !parentEvent || !rootEvent) return
    if (rootEvent.id === parentEvent.id) return // depth 1 — no chain to fill in
    const authors = Array.from(
      new Set([event.pubkey, parentEvent.pubkey, rootEvent.pubkey])
    )
    const filter =
      event.kind === kinds.ShortTextNote
        ? { authors, '#e': [rootEvent.id], kinds: [kinds.ShortTextNote] }
        : {
            authors,
            '#E': [rootEvent.id],
            kinds: [ExtendedKind.COMMENT, ExtendedKind.VOICE_COMMENT]
          }
    void client.fetchEvents(getDefaultRelayUrls(), filter, { cache: true }).catch(() => undefined)
  }, [event?.id, event?.kind, event?.pubkey, pillsSettled, parentEvent?.id, parentEvent?.pubkey, rootEvent?.id, rootEvent?.pubkey])

  // The first time the user reveals ancestors, position the focused note
  // Twitter-style — short notes get their bottom pushed to the viewport
  // bottom (maximising visible context above); notes taller than one
  // screen get their top aligned to the viewport top so the reader starts
  // from the beginning. Subsequent step expansions rely on the browser's
  // CSS scroll-anchoring to keep the focused note pinned.
  useEffect(() => {
    if (revealed === 0) {
      repositionedRef.current = false
      return
    }
    if (repositionedRef.current) return
    repositionedRef.current = true
    const raf = requestAnimationFrame(() => positionFocusedNote(focusedRef.current))
    return () => cancelAnimationFrame(raf)
  }, [revealed])

  if (!event && isFetching) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Note')}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2">
            <UserAvatarSkeleton className="h-10 w-10" />
            <div className={`w-0 flex-1`}>
              <div className="py-1">
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="py-0.5">
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
          <div className="pt-2">
            <div className="my-1">
              <Skeleton className="my-1 mt-2 h-4 w-full" />
            </div>
            <div className="my-1">
              <Skeleton className="my-1 h-4 w-2/3" />
            </div>
          </div>
        </div>
      </SecondaryPageLayout>
    )
  }
  if (!event) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Note')} displayScrollToTopButton>
        <NotFound bech32Id={id} />
      </SecondaryPageLayout>
    )
  }

  const known = chain.length
  const allRevealed = prefetchDone && revealed >= known
  // Once the full chain is known, both the step and full buttons would
  // reveal the same set whenever fewer than a STEP remain — in that case
  // hide the step button so the user only sees one action.
  const remaining = (prefetchDone ? known : Infinity) - revealed
  const showStepButton = !allRevealed && !(prefetchDone && remaining <= STEP)
  const stepEnabled = revealed < known
  const showFullButton = prefetchDone && !allRevealed
  // Reserve the button row's space from first render so its eventual reveal
  // doesn't shift the layout. When neither button is actionable yet — the
  // step button would be disabled and the full button isn't known yet — show
  // an inert "Gathering context..." line in the same slot.
  const showButtonRow = !!parentEventId && !allRevealed
  const gathering = showButtonRow && !stepEnabled && !showFullButton
  const visibleAncestorIds = chain.slice(0, revealed)
  const rootInVisibleChain = chainReachedRoot && revealed >= known
  const showRootPill = !!rootEventId && rootEventId !== parentEventId && !rootInVisibleChain
  const showParentPill = !!parentEventId && revealed === 0

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Note')} displayScrollToTopButton>
      <div className="px-4 pt-3">
        {rootITag && <ExternalRoot value={rootITag[1]} />}

        {showRootPill && (
          <ParentNote
            key={`root-note-${event.id}`}
            isFetching={isFetchingRootEvent}
            event={rootEvent}
            eventBech32Id={rootEventId!}
            isConsecutive={isConsecutive(rootEvent, parentEvent)}
          />
        )}

        {/* Buttons sit at the gap between the root pill and the revealed
            chain so clicks fill in missing notes right where they belong.
            Fixed-height row that holds either the "Gathering context..."
            placeholder or one/two side-by-side buttons — so the row's
            eventual content swap doesn't shift the layout. */}
        {showButtonRow && (
          <div className="my-3 flex h-8 flex-row gap-2">
            {gathering ? (
              <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
                {t('Gathering context...')}
              </div>
            ) : (
              <>
                {showStepButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRevealed((r) => Math.min(r + STEP, known))}
                    className="flex-1"
                  >
                    {t('Show more context')}
                  </Button>
                )}
                {showFullButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRevealed(known)}
                    className="flex-1"
                  >
                    {t('Show full context')}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Visible ancestors, top → bottom: deepest revealed first, parent last */}
        {[...visibleAncestorIds].reverse().map((bech32Id) => (
          <AncestorFromCache key={`ancestor-${bech32Id}`} bech32Id={bech32Id} />
        ))}

        {showParentPill && (
          <ParentNote
            key={`parent-note-${event.id}`}
            isFetching={isFetchingParentEvent}
            event={parentEvent}
            eventBech32Id={parentEventId!}
          />
        )}

        <div
          ref={focusedRef}
          className={cn(
            'scroll-mt-14',
            revealed > 0 && '-mx-4 border-y border-primary/40 bg-accent/30 px-4 py-3'
          )}
        >
          <Note
            key={`note-${event.id}`}
            event={event}
            className="select-text"
            hideParentNotePreview
            originalNoteId={id}
            showFull
          />
          <StuffStats
            className="mt-3"
            classNames={{ topList: '-mx-4', topListContent: 'px-4' }}
            stuff={event}
            fetchIfNotExisting
            displayTopZapsAndLikes
          />
        </div>
      </div>
      <Separator className="mt-4" />
      <NoteInteractions key={`note-interactions-${event.id}`} event={event} />
    </SecondaryPageLayout>
  )
})
NotePage.displayName = 'NotePage'
export default NotePage

function positionFocusedNote(el: HTMLDivElement | null) {
  if (!el) return
  const viewportHeight = getViewportHeight(el)
  const noteHeight = el.offsetHeight
  if (noteHeight + TITLEBAR_OFFSET_PX > viewportHeight) {
    el.scrollIntoView({ block: 'start' })
  } else {
    el.scrollIntoView({ block: 'end' })
  }
}

function getViewportHeight(el: HTMLElement): number {
  const container = getScrollContainer(el)
  return container?.clientHeight ?? window.innerHeight
}

function getScrollContainer(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  const radixViewport = el.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null
  if (radixViewport) return radixViewport
  let cur: HTMLElement | null = el.parentElement
  while (cur) {
    const style = getComputedStyle(cur)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') return cur
    cur = cur.parentElement
  }
  return null
}

function ExternalRoot({ value }: { value: string }) {
  const { push } = useSecondaryPage()

  return (
    <div>
      <Card
        className="clickable text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-1 text-sm"
        onClick={() => push(toExternalContent(value))}
      >
        <div className="truncate">{value}</div>
      </Card>
      <div className="bg-border ms-5 h-2 w-px" />
    </div>
  )
}

function ParentNote({
  event,
  eventBech32Id,
  isFetching,
  isConsecutive = true
}: {
  event?: Event
  eventBech32Id: string
  isFetching: boolean
  isConsecutive?: boolean
}) {
  const { push } = useSecondaryPage()

  if (isFetching) {
    return (
      <div>
        <div className="clickable text-muted-foreground flex items-center gap-1 rounded-full border px-1.75 py-1 text-sm">
          <UserAvatarSkeleton className="h-4 w-4 shrink" />
          <div className="flex-1 py-1">
            <Skeleton className="h-3" />
          </div>
        </div>
        <div className="bg-border ms-5 h-3 w-px" />
      </div>
    )
  }

  return (
    <div>
      <div
        className={cn(
          'clickable text-muted-foreground flex items-center gap-1 rounded-full border px-1.75 py-1 text-sm',
          event && 'hover:text-foreground'
        )}
        onClick={() => {
          push(toNote(event ?? eventBech32Id))
        }}
      >
        {event && <UserAvatar userId={event.pubkey} size="tiny" className="shrink-0" />}
        <ContentPreview className="truncate" event={event} />
      </div>
      {isConsecutive ? (
        <div className="bg-border ms-5 h-3 w-px" />
      ) : (
        <Ellipsis className="text-muted-foreground/60 ms-3.5 size-3" />
      )}
    </div>
  )
}

function isConsecutive(rootEvent?: Event, parentEvent?: Event) {
  if (!rootEvent || !parentEvent) return false

  const tag = getParentTag(parentEvent)
  if (!tag) return false

  return getEventKey(rootEvent) === getKeyFromTag(tag.tag)
}

function AncestorFromCache({ bech32Id }: { bech32Id: string }) {
  const { event, isFetching } = useFetchEvent(bech32Id)
  const { push } = useSecondaryPage()
  const { t } = useTranslation()

  if (isFetching) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <UserAvatarSkeleton className="h-10 w-10" />
          <div className="w-0 flex-1">
            <div className="py-1">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="py-0.5">
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
        <div className="pt-2">
          <Skeleton className="my-1 h-3 w-full" />
          <Skeleton className="my-1 h-3 w-2/3" />
        </div>
        <Separator className="my-3" />
      </div>
    )
  }

  if (!event) {
    return (
      <div>
        <div
          className="clickable text-muted-foreground flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-sm hover:text-foreground"
          onClick={() => push(toNote(bech32Id))}
        >
          {t('Note not found')}
        </div>
        <Separator className="my-3" />
      </div>
    )
  }

  return (
    <div>
      <div
        className="clickable -mx-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent/30"
        onClick={(e) => {
          e.stopPropagation()
          push(toNote(event))
        }}
      >
        <Note event={event} hideParentNotePreview showFull />
      </div>
      <Separator className="my-3" />
    </div>
  )
}

import { useFetchProfile } from '@/hooks'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Event as NEvent, kinds } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import Highlight from '../Note/Highlight'
import { useSecondaryPage } from '@/PageManager'
import { toNote } from '@/lib/link'
import { FormattedTimestamp } from '../FormattedTimestamp'
import NoteStats from '../NoteStats'
import NoteOptions from '../NoteOptions'

type HighlightsByUser = {
  pubkey: string
  highlights: NEvent[]
  count: number
}

export default function HighlightsList() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [highlights, setHighlights] = useState<NEvent[]>([])
  const [selectedPubkey, setSelectedPubkey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const groupedHighlights = useMemo(() => {
    const groups = new Map<string, NEvent[]>()

    highlights.forEach((highlight) => {
      const author = highlight.pubkey
      if (!groups.has(author)) {
        groups.set(author, [])
      }
      groups.get(author)!.push(highlight)
    })

    const result: HighlightsByUser[] = Array.from(groups.entries()).map(
      ([pubkey, highlights]) => ({
        pubkey,
        highlights: highlights.sort((a, b) => b.created_at - a.created_at),
        count: highlights.length
      })
    )

    // Sort by count (most highlights first)
    return result.sort((a, b) => b.count - a.count)
  }, [highlights])

  // Prefetch profiles for all authors as highlights arrive
  useEffect(() => {
    if (highlights.length === 0) return

    const uniquePubkeys = Array.from(new Set(highlights.map(h => h.pubkey)))

    // Trigger profile fetches in batches to avoid overwhelming the relays
    const batchSize = 10
    for (let i = 0; i < uniquePubkeys.length; i += batchSize) {
      const batch = uniquePubkeys.slice(i, i + batchSize)
      // The client service will handle fetching profiles
      batch.forEach(pubkey => {
        client.fetchProfile(pubkey).catch(() => {
          // Silently fail - profile will show skeleton
        })
      })
    }
  }, [highlights])

  useEffect(() => {
    async function fetchHighlights() {
      if (!pubkey) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setHighlights([]) // Clear existing highlights

      try {
        const followings = await client.fetchFollowings(pubkey)
        const authors = [pubkey, ...followings]

        // Fetch highlights from all followed users
        const subRequests = await client.generateSubRequestsForPubkeys(authors, pubkey)

        // Fetch highlights progressively and update state as they arrive
        for (const subRequest of subRequests) {
          client.fetchEvents(subRequest.urls, {
            ...subRequest.filter,
            kinds: [kinds.Highlights],
            limit: 100
          }).then((events) => {
            if (events.length > 0) {
              setHighlights((prev) => [...prev, ...events])
            }
          })
        }
      } catch (error) {
        console.error('Error fetching highlights:', error)
      } finally {
        // Set loading to false after a short delay to allow initial events to arrive
        setTimeout(() => setIsLoading(false), 1000)
      }
    }

    fetchHighlights()
  }, [pubkey])

  if (isLoading && groupedHighlights.length === 0) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2 ${i < 4 ? 'border-b' : ''}`}
          >
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!isLoading && groupedHighlights.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground mt-4">
        {t('No highlights found from your followings')}
      </div>
    )
  }

  // If a user is selected, show their highlights
  if (selectedPubkey) {
    const userHighlights = groupedHighlights.find((g) => g.pubkey === selectedPubkey)
    if (!userHighlights) {
      setSelectedPubkey(null)
      return null
    }

    return (
      <div>
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => setSelectedPubkey(null)}
            className="mb-2"
          >
            ← {t('Back to all highlights')}
          </Button>
          <UserHighlightsHeader pubkey={selectedPubkey} count={userHighlights.count} />
        </div>
        <div>
          {userHighlights.highlights.map((highlight, index) => (
            <HighlightItem
              key={highlight.id}
              event={highlight}
              isLast={index === userHighlights.highlights.length - 1}
            />
          ))}
        </div>
      </div>
    )
  }

  // Show grouped list
  return (
    <div>
      {groupedHighlights.map((group, index) => (
        <UserHighlightCard
          key={group.pubkey}
          pubkey={group.pubkey}
          count={group.count}
          onClick={() => setSelectedPubkey(group.pubkey)}
          isLast={index === groupedHighlights.length - 1}
        />
      ))}
    </div>
  )
}

function UserHighlightCard({
  pubkey,
  count,
  onClick,
  isLast
}: {
  pubkey: string
  count: number
  onClick: () => void
  isLast: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 clickable hover:bg-accent/50 transition-colors cursor-pointer ${!isLast ? 'border-b' : ''}`}
      onClick={onClick}
    >
      <UserAvatar userId={pubkey} size="normal" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">
          <Username userId={pubkey} />
        </div>
      </div>
      <div className="flex items-center justify-center min-w-[2rem] h-8 px-3 bg-primary/10 text-primary rounded-full font-semibold text-sm">
        {count}
      </div>
    </div>
  )
}

function UserHighlightsHeader({ pubkey, count }: { pubkey: string; count: number }) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-3 p-4 border rounded-lg">
      <UserAvatar userId={pubkey} size="big" />
      <div>
        <div className="text-xl font-bold">
          <Username userId={pubkey} />
        </div>
        <div className="text-muted-foreground">
          {count} {count === 1 ? t('highlight') : t('highlights')}
        </div>
      </div>
    </div>
  )
}

function HighlightItem({ event, isLast }: { event: NEvent; isLast: boolean }) {
  const { push } = useSecondaryPage()

  return (
    <div
      className={`py-2 clickable ${!isLast ? 'border-b' : ''}`}
      onClick={() => push(toNote(event))}
    >
      <div className="flex space-x-2 items-start px-4">
        <UserAvatar userId={event.pubkey} size="compact" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold truncate">
              <Username userId={event.pubkey} />
            </span>
            <span className="text-muted-foreground">·</span>
            <FormattedTimestamp timestamp={event.created_at} />
          </div>
          <Highlight event={event} />
          <div className="flex items-center justify-between pt-2">
            <NoteStats event={event} />
            <NoteOptions event={event} />
          </div>
        </div>
      </div>
    </div>
  )
}

import { useFetchProfile } from '@/hooks'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Event as NEvent, kinds } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import { Button } from '../ui/button'
import NoteCard from '../NoteCard'
import { Skeleton } from '../ui/skeleton'

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
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
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
        <div className="space-y-2">
          {userHighlights.highlights.map((highlight) => (
            <NoteCard key={highlight.id} event={highlight} className="w-full" />
          ))}
        </div>
      </div>
    )
  }

  // Show grouped list
  return (
    <div className="space-y-2">
      {groupedHighlights.map((group) => (
        <UserHighlightCard
          key={group.pubkey}
          pubkey={group.pubkey}
          count={group.count}
          onClick={() => setSelectedPubkey(group.pubkey)}
        />
      ))}
    </div>
  )
}

function UserHighlightCard({
  pubkey,
  count,
  onClick
}: {
  pubkey: string
  count: number
  onClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="flex items-center gap-3 p-4 border rounded-lg clickable hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <UserAvatar pubkey={pubkey} size={48} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">
          <Username pubkey={pubkey} />
        </div>
        <div className="text-sm text-muted-foreground">
          {count} {count === 1 ? t('highlight') : t('highlights')}
        </div>
      </div>
    </div>
  )
}

function UserHighlightsHeader({ pubkey, count }: { pubkey: string; count: number }) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(pubkey)

  return (
    <div className="flex items-center gap-3 p-4 border rounded-lg">
      <UserAvatar pubkey={pubkey} size={64} />
      <div>
        <div className="text-xl font-bold">
          <Username pubkey={pubkey} />
        </div>
        <div className="text-muted-foreground">
          {count} {count === 1 ? t('highlight') : t('highlights')}
        </div>
      </div>
    </div>
  )
}

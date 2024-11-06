import { createRepostDraftEvent } from '@renderer/lib/draft-event'
import { cn } from '@renderer/lib/utils'
import { useNostr } from '@renderer/providers/NostrProvider'
import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import { Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { formatCount } from './utils'

export default function RepostButton({
  event,
  canFetch = false
}: {
  event: Event
  canFetch?: boolean
}) {
  const { pubkey, publish } = useNostr()
  const { noteStatsMap, fetchNoteRepostCount, fetchNoteRepostedStatus, markNoteAsReposted } =
    useNoteStats()
  const [reposting, setReposting] = useState(false)
  const { repostCount, hasReposted } = useMemo(
    () => noteStatsMap.get(event.id) ?? {},
    [noteStatsMap, event.id]
  )
  const canRepost = pubkey && !hasReposted && !reposting

  useEffect(() => {
    if (!canFetch) return

    if (repostCount === undefined) {
      fetchNoteRepostCount(event)
    }
    if (hasReposted === undefined) {
      fetchNoteRepostedStatus(event)
    }
  }, [])

  const repost = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canRepost) return

    setReposting(true)
    const timer = setTimeout(() => setReposting(false), 5000)

    try {
      const repost = createRepostDraftEvent(event)
      await publish(repost)
      markNoteAsReposted(event.id)
    } catch (error) {
      console.error('repost failed', error)
    } finally {
      setReposting(false)
      clearTimeout(timer)
    }
  }

  return (
    <button
      className={cn(
        'flex gap-1 items-center enabled:hover:text-lime-500',
        hasReposted ? 'text-lime-500' : 'text-muted-foreground'
      )}
      onClick={repost}
      disabled={!canRepost}
      title="repost"
    >
      <Repeat size={16} />
      <div className="text-xs">{formatCount(repostCount)}</div>
    </button>
  )
}

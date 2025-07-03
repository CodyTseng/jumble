import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { createReactionDraftEvent } from '@/lib/draft-event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import noteStatsService from '@/services/note-stats.service'
import { TEmoji } from '@/types'
import { Loader } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import Emoji from '../Emoji'

export default function Likes({ event }: { event: Event }) {
  const { pubkey, checkLogin, publish } = useNostr()
  const noteStats = useNoteStatsById(event.id)
  const [liking, setLiking] = useState<string | null>(null)
  const likes = useMemo(() => {
    const _likes = noteStats?.likes
    if (!_likes) return []

    const stats = new Map<string, { key: string; emoji: TEmoji | string; pubkeys: Set<string> }>()
    _likes.forEach((item) => {
      const key = typeof item.emoji === 'string' ? item.emoji : item.emoji.url
      if (!stats.has(key)) {
        stats.set(key, { key, pubkeys: new Set(), emoji: item.emoji })
      }
      stats.get(key)?.pubkeys.add(item.pubkey)
    })
    return Array.from(stats.values()).sort((a, b) => b.pubkeys.size - a.pubkeys.size)
  }, [noteStats, event])

  if (!likes.length) return null

  const like = async (key: string, emoji: TEmoji | string) => {
    checkLogin(async () => {
      if (liking || !pubkey) return

      setLiking(key)
      const timer = setTimeout(() => setLiking((prev) => (prev === key ? null : prev)), 5000)

      try {
        const reaction = createReactionDraftEvent(event, emoji)
        const evt = await publish(reaction)
        noteStatsService.updateNoteStatsByEvents([evt])
      } catch (error) {
        console.error('like failed', error)
      } finally {
        setLiking(null)
        clearTimeout(timer)
      }
    })
  }

  return (
    <ScrollArea className="pb-2 mb-1">
      <div className="flex gap-1">
        {likes.map(({ key, emoji, pubkeys }) => (
          <div
            key={key}
            className={cn(
              'flex h-7 w-fit gap-2 px-2 rounded-full items-center border shrink-0',
              pubkey && pubkeys.has(pubkey)
                ? 'border-primary bg-primary/20 text-foreground cursor-not-allowed'
                : 'transition-colors bg-muted/80 text-muted-foreground cursor-pointer hover:bg-primary/40 hover:border-primary hover:text-foreground'
            )}
            onClick={(e) => {
              e.stopPropagation()
              like(key, emoji)
            }}
          >
            {liking === key ? <Loader className="animate-spin size-4" /> : <Emoji emoji={emoji} />}
            <div className="text-sm">{pubkeys.size}</div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

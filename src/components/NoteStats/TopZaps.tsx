import { useSecondaryPage } from '@/PageManager'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { formatAmount } from '@/lib/lightning'
import { toProfile } from '@/lib/link'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { SimpleUserAvatar } from '../UserAvatar'

export default function TopZaps({ event }: { event: Event }) {
  const { push } = useSecondaryPage()
  const { noteStatsMap } = useNoteStats()
  const topZaps = useMemo(() => {
    const stats = noteStatsMap.get(event.id) || {}
    return stats.zaps?.slice(0, 10) || []
  }, [noteStatsMap, event])

  if (!topZaps.length) return null

  return (
    <ScrollArea className="pb-2 mb-1">
      <div className="flex gap-1">
        {topZaps.map((zap) => (
          <div
            key={zap.pr}
            className="flex gap-1 py-1 pl-1 pr-2 text-sm rounded-full bg-muted items-center text-yellow-400 clickable"
            onClick={(e) => {
              e.stopPropagation()
              push(toProfile(zap.pubkey))
            }}
          >
            <SimpleUserAvatar userId={zap.pubkey} size="xSmall" />
            <Zap className="size-3 fill-yellow-400" />
            <div className="font-semibold">{formatAmount(zap.amount)}</div>
            <div className="truncate">{zap.comment}</div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

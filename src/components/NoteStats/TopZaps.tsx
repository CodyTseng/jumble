import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { formatAmount } from '@/lib/lightning'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { SimpleUserAvatar } from '../UserAvatar'
import ZapDialog from '../ZapDialog'

export default function TopZaps({ event }: { event: Event }) {
  const noteStats = useNoteStatsById(event.id)
  const [zapIndex, setZapIndex] = useState(-1)
  const topZaps = useMemo(() => {
    return noteStats?.zaps?.sort((a, b) => b.amount - a.amount).slice(0, 10) || []
  }, [noteStats])

  if (!topZaps.length) return null

  return (
    <ScrollArea className="pb-2 mb-1">
      <div className="flex gap-1">
        {topZaps.map((zap, index) => (
          <div
            key={zap.pr}
            className="flex gap-1 py-1 pl-1 pr-2 text-sm max-w-72 rounded-full bg-muted/80 items-center text-yellow-400 border border-yellow-400 hover:bg-yellow-400/20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              setZapIndex(index)
            }}
          >
            <SimpleUserAvatar userId={zap.pubkey} size="xSmall" />
            <Zap className="size-3 fill-yellow-400 shrink-0" />
            <div className="font-semibold">{formatAmount(zap.amount)}</div>
            <div className="truncate">{zap.comment}</div>
            <div onClick={(e) => e.stopPropagation()}>
              <ZapDialog
                open={zapIndex === index}
                setOpen={(open) => {
                  if (open) {
                    setZapIndex(index)
                  } else {
                    setZapIndex(-1)
                  }
                }}
                pubkey={event.pubkey}
                event={event}
                defaultAmount={zap.amount}
                defaultComment={zap.comment}
              />
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useStuff } from '@/hooks/useStuff'
import { useStuffStatsById } from '@/hooks/useStuffStatsById'
import { createFakeEvent } from '@/lib/event'
import { formatAmount } from '@/lib/lightning'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import ContentPreview from '../ContentPreview'
import { SimpleUserAvatar } from '../UserAvatar'
import ZapDetailDialog from '../ZapDetailDialog'

export default function TopZaps({ stuff }: { stuff: Event | string }) {
  const { event, stuffKey } = useStuff(stuff)
  const noteStats = useStuffStatsById(stuffKey)
  const [zapIndex, setZapIndex] = useState(-1)
  const topZaps = useMemo(() => {
    return noteStats?.zaps?.sort((a, b) => b.amount - a.amount).slice(0, 10) || []
  }, [noteStats])

  if (!topZaps.length || !event) return null

  return (
    <ScrollArea className="mb-1 pb-2">
      <div className="flex gap-1">
        {topZaps.map((zap, index) => (
          <div key={zap.pr}>
            <div
              className="flex max-w-72 cursor-pointer items-center gap-1 rounded-full border border-yellow-400 bg-muted/80 py-1 ps-1 pe-2 text-sm text-yellow-400 hover:bg-yellow-400/20"
              onClick={(e) => {
                e.stopPropagation()
                setZapIndex(index)
              }}
            >
              <SimpleUserAvatar userId={zap.pubkey} size="xSmall" />
              <Zap className="size-3 shrink-0 fill-yellow-400" />
              <div className="font-semibold">{formatAmount(zap.amount)}</div>
              <ContentPreview
                className="truncate"
                event={createFakeEvent({
                  content: zap.comment
                })}
              />
            </div>
            <ZapDetailDialog
              open={zapIndex === index}
              setOpen={(open) => {
                if (open) {
                  setZapIndex(index)
                } else {
                  setZapIndex(-1)
                }
              }}
              zap={zap}
            />
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

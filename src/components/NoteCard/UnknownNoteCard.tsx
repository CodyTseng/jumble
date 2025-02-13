import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getSharableEventId } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'

export default function UnknownNoteCard({
  event,
  className,
  embedded = false
}: {
  event: Event
  className?: string
  embedded?: boolean
}) {
  const [isCopied, setIsCopied] = useState(false)

  return (
    <div className={className}>
      <div
        className={cn(
          'flex flex-col items-center text-muted-foreground font-medium gap-2',
          embedded ? 'p-2 sm:p-3 border rounded-lg' : 'px-4 py-3'
        )}
      >
        <div>kind {event.kind}</div>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.writeText(getSharableEventId(event))
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
          }}
          variant="ghost"
        >
          {isCopied ? <Check /> : <Copy />} Copy event ID
        </Button>
      </div>
      {!embedded && <Separator />}
    </div>
  )
}

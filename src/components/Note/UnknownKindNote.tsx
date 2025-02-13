import { Button } from '@/components/ui/button'
import { getSharableEventId } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'

export default function UnknownKindNote({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const [isCopied, setIsCopied] = useState(false)

  return (
    <div
      className={cn(
        'flex flex-col items-center text-muted-foreground font-medium gap-2',
        className
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
  )
}

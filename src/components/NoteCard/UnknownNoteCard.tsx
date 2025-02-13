import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getSharableEventId } from '@/lib/event'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import RepostDescription from './RepostDescription'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import { FormattedTimestamp } from '../FormattedTimestamp'
import { useTranslation } from 'react-i18next'

export default function UnknownNoteCard({
  event,
  className,
  embedded = false,
  reposter
}: {
  event: Event
  className?: string
  embedded?: boolean
  reposter?: string
}) {
  const { t } = useTranslation()
  const [isCopied, setIsCopied] = useState(false)

  return (
    <div className={className}>
      <div className={cn(embedded ? 'p-2 sm:p-3 border rounded-lg' : 'px-4 py-3')}>
        <RepostDescription reposter={reposter} />
        <div className="flex items-center space-x-2">
          <UserAvatar userId={event.pubkey} size={embedded ? 'small' : 'normal'} />
          <div
            className={`flex-1 w-0 ${embedded ? 'flex space-x-2 items-center overflow-hidden' : ''}`}
          >
            <Username
              userId={event.pubkey}
              className={cn('font-semibold flex truncate', embedded ? 'text-sm' : '')}
              skeletonClassName={embedded ? 'h-3' : 'h-4'}
            />
            <div className="text-xs text-muted-foreground line-clamp-1">
              <FormattedTimestamp timestamp={event.created_at} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-center text-muted-foreground font-medium mt-2">
          <div>{t('Cannot handle event of kind k', { k: event.kind })}</div>
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
      </div>
      {!embedded && <Separator />}
    </div>
  )
}

import { useFetchEvent } from '@/hooks'
import { formatAmount, getAmountFromInvoice } from '@/lib/lightning'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'
import { ContentPreview } from './ContentPreview'

export function ZapNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  const { senderPubkey, eventId, amount } = useMemo(() => {
    const senderPubkey = notification.tags.find(tagNameEquals('P'))?.[1]
    const eventId = notification.tags.find(tagNameEquals('e'))?.[1]
    const invoice = notification.tags.find(tagNameEquals('bolt11'))?.[1]
    const amount = invoice ? getAmountFromInvoice(invoice) : 0
    return { senderPubkey, eventId, amount }
  }, [notification])
  const { event } = useFetchEvent(eventId)

  if (!senderPubkey || !amount) return null

  return (
    <div
      className="flex gap-2 items-center cursor-pointer py-2"
      onClick={() => event && push(toNote(event))}
    >
      <UserAvatar userId={senderPubkey} size="small" />
      <Zap size={24} className="text-yellow-400" />
      <div className="font-semibold text-yellow-400">{formatAmount(amount)} stats</div>
      <ContentPreview event={event} />
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}

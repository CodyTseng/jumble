import { useFetchEvent } from '@/hooks'
import { formatAmount, getAmountFromInvoice } from '@/lib/lightning'
import { toNote, toProfile } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'
import { ContentPreview } from './ContentPreview'

export function ZapNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const { senderPubkey, eventId, amount, comment } = useMemo(() => {
    const result: { senderPubkey?: string; eventId?: string; amount?: number; comment?: string } =
      {}
    try {
      result.senderPubkey = notification.tags.find(tagNameEquals('P'))?.[1]
      result.eventId = notification.tags.find(tagNameEquals('e'))?.[1]
      const invoice = notification.tags.find(tagNameEquals('bolt11'))?.[1]
      result.amount = invoice ? getAmountFromInvoice(invoice) : 0
      const description = notification.tags.find(tagNameEquals('description'))?.[1]
      if (description) {
        const zapRequest = JSON.parse(description)
        result.comment = zapRequest.content
      }
    } catch {
      // ignore
    }
    return result
  }, [notification])
  const { event } = useFetchEvent(eventId)

  if (!senderPubkey || !amount) return null

  return (
    <div
      className="flex items-center justify-between cursor-pointer py-2"
      onClick={() => (event ? push(toNote(event)) : pubkey ? push(toProfile(pubkey)) : null)}
    >
      <div className="flex gap-2 items-center flex-1 w-0">
        <UserAvatar userId={senderPubkey} size="small" />
        <Zap size={24} className="text-yellow-400 shrink-0" />
        <div className="font-semibold text-yellow-400 shrink-0">{formatAmount(amount)} stats</div>
        {comment && <div className="text-yellow-400 truncate">{comment}</div>}
        <ContentPreview event={event} />
      </div>
      <div className="text-muted-foreground shrink-0">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}

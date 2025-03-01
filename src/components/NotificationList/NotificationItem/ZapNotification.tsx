import { useFetchEvent } from '@/hooks'
import { extractZapInfoFromReceipt } from '@/lib/event'
import { formatAmount } from '@/lib/lightning'
import { toNote, toProfile } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ContentPreview from '../../ContentPreview'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'

export function ZapNotification({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const { senderPubkey, eventId, amount, comment } = useMemo(
    () => extractZapInfoFromReceipt(notification) ?? ({} as any),
    [notification]
  )
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
        <div className="font-semibold text-yellow-400 shrink-0">
          {formatAmount(amount)} {t('sats')}
        </div>
        {comment && <div className="text-yellow-400 truncate">{comment}</div>}
        <ContentPreview
          className={cn('truncate flex-1 w-0', isNew ? 'font-semibold' : 'text-muted-foreground')}
          event={event}
        />
      </div>
      <div className="text-muted-foreground shrink-0">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}

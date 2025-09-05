import { useFetchEvent } from '@/hooks'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import { formatAmount } from '@/lib/lightning'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Notification from './Notification'

export function ZapNotification({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { t } = useTranslation()
  const { senderPubkey, eventId, amount, comment } = useMemo(
    () => getZapInfoFromEvent(notification) ?? ({} as any),
    [notification]
  )
  const { event } = useFetchEvent(eventId)

  if (!senderPubkey || !amount) return null

  return (
    <Notification
      notificationId={notification.id}
      icon={<Zap size={24} className="text-yellow-400 shrink-0" />}
      sender={senderPubkey}
      sentAt={notification.created_at}
      targetEvent={event}
      middle={
        <div className="font-semibold text-yellow-400 shrink-0">
          {formatAmount(amount)} {t('sats')} {comment}
        </div>
      }
      description={event ? t('zapped your note') : t('zapped you')}
      isNew={isNew}
    />
  )
}

import { useFetchEvent } from '@/hooks'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import { formatAmount } from '@/lib/lightning'
import { toNote } from '@/lib/link'
import lightning from '@/services/lightning.service'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
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
  const [valid, setValid] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    lightning.validateZapReceipt(notification).then((result) => {
      if (!cancelled) setValid(result)
    })
    return () => {
      cancelled = true
    }
  }, [notification])

  if (!senderPubkey || !amount || !valid) return null

  return (
    <Notification
      notificationId={notification.id}
      icon={<Zap size={24} className="shrink-0 text-yellow-400" />}
      sender={senderPubkey}
      sentAt={notification.created_at}
      targetEvent={event}
      targetPath={toNote(notification)}
      middle={
        <div className="truncate font-semibold text-yellow-400">
          {formatAmount(amount)} {t('sats')} {comment}
        </div>
      }
      description={event ? t('zapped your note') : t('zapped you')}
      isNew={isNew}
    />
  )
}

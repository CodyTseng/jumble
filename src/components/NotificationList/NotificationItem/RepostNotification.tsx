import client from '@/services/client.service'
import { Repeat } from 'lucide-react'
import { Event, validateEvent } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Notification from './Notification'

export function RepostNotification({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { t } = useTranslation()
  const event = useMemo(() => {
    try {
      const event = JSON.parse(notification.content) as Event
      const isValid = validateEvent(event)
      if (!isValid) return null
      client.addEventToCache(event)
      return event
    } catch {
      return null
    }
  }, [notification.content])
  if (!event) return null

  return (
    <Notification
      notificationId={notification.id}
      icon={<Repeat size={24} className="text-green-400" />}
      sender={notification.pubkey}
      sentAt={notification.created_at}
      targetEvent={event}
      description={t('reposted your note')}
      isNew={isNew}
    />
  )
}

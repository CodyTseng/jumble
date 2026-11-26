import { useFetchEvent } from '@/hooks'
import { generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
import { Vote } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Notification from './Notification'
import { useTranslation } from 'react-i18next'

export function PollResponseNotification({
  notification,
  isNew = false,
  onVisibilityChange
}: {
  notification: Event
  isNew?: boolean
  onVisibilityChange?: (isVisible: boolean) => void
}) {
  const { t } = useTranslation()
  const eventId = useMemo(() => {
    const eTag = notification.tags.find(tagNameEquals('e'))
    return eTag ? generateBech32IdFromETag(eTag) : undefined
  }, [notification])
  const { event: pollEvent } = useFetchEvent(eventId)

  if (!pollEvent) {
    return null
  }

  return (
    <Notification
      notificationId={notification.id}
      icon={<Vote size={24} className="text-violet-400" />}
      sender={notification.pubkey}
      sentAt={notification.created_at}
      targetEvent={pollEvent}
      targetIsContext
      description={t('voted in your poll')}
      otherNoteDescription={t('voted in a poll')}
      isNew={isNew}
      onVisibilityChange={onVisibilityChange}
    />
  )
}

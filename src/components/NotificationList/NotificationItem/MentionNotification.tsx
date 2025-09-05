import ParentNotePreview from '@/components/ParentNotePreview'
import { getEmbeddedPubkeys, getParentBech32Id } from '@/lib/event'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { AtSign, MessageCircle, Quote } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Notification from './Notification'

export function MentionNotification({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const isMention = useMemo(() => {
    if (!pubkey) return false
    const mentions = getEmbeddedPubkeys(notification)
    return mentions.includes(pubkey)
  }, [pubkey, notification])
  const parentEventId = useMemo(() => getParentBech32Id(notification), [notification])

  return (
    <Notification
      notificationId={notification.id}
      icon={
        isMention ? (
          <AtSign size={24} className="text-pink-400" />
        ) : parentEventId ? (
          <MessageCircle size={24} className="text-blue-400" />
        ) : (
          <Quote size={24} className="text-green-400" />
        )
      }
      sender={notification.pubkey}
      sentAt={notification.created_at}
      targetEvent={notification}
      middle={
        parentEventId && (
          <ParentNotePreview
            eventId={parentEventId}
            className=""
            onClick={(e) => {
              e.stopPropagation()
              push(toNote(parentEventId))
            }}
          />
        )
      }
      description={
        isMention ? t('mentioned you in a note') : parentEventId ? '' : t('quoted your note')
      }
      isNew={isNew}
      showStats
    />
  )
}

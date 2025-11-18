import ParentNotePreview from '@/components/ParentNotePreview'
import { NOTIFICATION_LIST_STYLE } from '@/constants'
import { getEmbeddedPubkeys, getParentStuff } from '@/lib/event'
import { toExternalContent, toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
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
  const { notificationListStyle } = useUserPreferences()
  const isMention = useMemo(() => {
    if (!pubkey) return false
    const mentions = getEmbeddedPubkeys(notification)
    return mentions.includes(pubkey)
  }, [pubkey, notification])
  const { parentEventId, parentExternalContent } = useMemo(() => {
    return getParentStuff(notification)
  }, [notification])

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
        notificationListStyle === NOTIFICATION_LIST_STYLE.DETAILED && (
          <ParentNotePreview
            eventId={parentEventId}
            externalContent={parentExternalContent}
            className=""
            onClick={(e) => {
              e.stopPropagation()
              if (parentExternalContent) {
                push(toExternalContent(parentExternalContent))
              } else if (parentEventId) {
                push(toNote(parentEventId))
              }
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

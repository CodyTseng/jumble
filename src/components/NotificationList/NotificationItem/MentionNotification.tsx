import ParentNotePreview from '@/components/ParentNotePreview'
import { ExtendedKind, NOTIFICATION_LIST_STYLE } from '@/constants'
import { getEmbeddedPubkeys, getParentStuff, getParentTag } from '@/lib/event'
import { toExternalContent, toNote } from '@/lib/link'
import { generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNotificationUserPreference } from '@/providers/NotificationUserPreferenceProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import client from '@/services/client.service'
import { AtSign, MessageCircle, Quote } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Notification from './Notification'

export function MentionNotification({
  notification,
  isNew = false,
  onVisibilityChange
}: {
  notification: Event
  isNew?: boolean
  onVisibilityChange?: (isVisible: boolean) => void
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const { notificationListStyle } = useUserPreferences()
  const { hideIndirect } = useNotificationUserPreference()
  const isMention = useMemo(() => {
  const nostrList = notification.tags.find(tag => tag[0] === 'e' && tag[3] === '30000');
  if (nostrList) {
    const listPubkey = nostrList[1];
    const listEvent = await client.fetchEvent(listPubkey);
    if (listEvent) {
      const listMentions = listEvent.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
      if (listMentions.includes(pubkey)) {
        return true;
      }
    }
  }
  return false;
}, [pubkey, notification])

const isListMention = useMemo(() => {
  const nostrList = notification.tags.find(tag => tag[0] === 'e' && tag[3] === '30000');
  if (nostrList) {
    const listPubkey = nostrList[1];
    const listEvent = await client.fetchEvent(listPubkey);
    if (listEvent) {
      const listMentions = listEvent.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
      if (listMentions.includes(pubkey)) {
        return true;
      }
    }
  }
  return false;
}, [pubkey, notification])

const isMention = useMemo(() => {
  if (!pubkey) return false;
  const mentions = getEmbeddedPubkeys(notification);
  return mentions.includes(pubkey) || isListMention;
}, [pubkey, notification])

const { parentEventId, parentExternalContent } = useMemo(() => {
  return getParentStuff(notification);
}, [notification])

const [isDirectMention, setIsDirectMention] = useState(false);
useEffect(() => {
  const checkIsDirectMention = async () => {
    if (!pubkey) return false;
    if (isMention) return true;
    if (notification.kind === ExtendedKind.POLL) return true;

    if (
      notification.kind === ExtendedKind.VOICE_COMMENT ||
      notification.kind === ExtendedKind.COMMENT
    ) {
      const parentPTag = notification.tags.findLast(tagNameEquals('p'));
      const parentPubkey = parentPTag?.[1];
      return parentPubkey === pubkey;
    }

    const parentTag = getParentTag(notification);
    if (parentTag?.type === 'e') {
      const [, , , , parentPubkey] = parentTag.tag;
      if (parentPubkey) {
        return parentPubkey === pubkey;
      }
      const parentEventId = generateBech32IdFromETag(parentTag.tag);
      if (!parentEventId) return false;
      const parentEvent = await client.fetchEvent(parentEventId);
      if (parentEvent) {
        return parentEvent.pubkey === pubkey;
      }
      return false;
    }
    if (parentTag?.type === 'a') {
      const coordinate = parentTag.tag[1];
      const [, parentPubkey] = coordinate.split(':');
      return parentPubkey === pubkey;
    }
    return false;
  }
  checkIsDirectMention().then(setIsDirectMention);
}, [pubkey, notification, isMention])

if (hideIndirect && !isDirectMention) {
  return null;
}

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
    onVisibilityChange={onVisibilityChange}
  />
);
    if (!pubkey) return false
    const mentions = getEmbeddedPubkeys(notification)
    return mentions.includes(pubkey)
  }, [pubkey, notification])
  const { parentEventId, parentExternalContent } = useMemo(() => {
    return getParentStuff(notification)
  }, [notification])
  const [isDirectMention, setIsDirectMention] = useState(false)
  useEffect(() => {
    const checkIsDirectMention = async () => {
      if (!pubkey) return false
      if (isMention) return true
      if (notification.kind === ExtendedKind.POLL) return true

      if (
        notification.kind === ExtendedKind.VOICE_COMMENT ||
        notification.kind === ExtendedKind.COMMENT
      ) {
        const parentPTag = notification.tags.findLast(tagNameEquals('p'))
        const parentPubkey = parentPTag?.[1]
        return parentPubkey === pubkey
      }

      const parentTag = getParentTag(notification)
      if (parentTag?.type === 'e') {
        const [, , , , parentPubkey] = parentTag.tag
        if (parentPubkey) {
          return parentPubkey === pubkey
        }
        const parentEventId = generateBech32IdFromETag(parentTag.tag)
        if (!parentEventId) return false
        const parentEvent = await client.fetchEvent(parentEventId)
        if (parentEvent) {
          return parentEvent.pubkey === pubkey
        }
        return false
      }
      if (parentTag?.type === 'a') {
        const coordinate = parentTag.tag[1]
        const [, parentPubkey] = coordinate.split(':')
        return parentPubkey === pubkey
      }
      return false
    }
    checkIsDirectMention().then(setIsDirectMention)
  }, [pubkey, notification, isMention])

  if (hideIndirect && !isDirectMention) {
    return null
  }

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
      onVisibilityChange={onVisibilityChange}
    />
  )
}

import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import dmMessageService from '@/services/dm-message.service'
import encryptionKeyService from '@/services/encryption-key.service'
import { TDmConversation } from '@/types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toDmConversation } from '@/lib/link'

dayjs.extend(relativeTime)

export default function DmList() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { push } = useSecondaryPage()
  const [conversations, setConversations] = useState<TDmConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadConversations = useCallback(async () => {
    if (!pubkey) return

    try {
      const convs = await dmMessageService.getConversations(pubkey)
      setConversations(convs)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [pubkey])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!pubkey) return

    const encryptionKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
    if (!encryptionKeypair) return

    const handleNewMessage = () => {
      loadConversations()
    }

    const unsubscribe = dmMessageService.subscribeToMessages(
      pubkey,
      encryptionKeypair,
      handleNewMessage
    )

    return () => {
      unsubscribe()
    }
  }, [pubkey, loadConversations])

  const handleConversationClick = (conv: TDmConversation) => {
    push(toDmConversation(conv.pubkey))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
        <MessageSquare className="h-16 w-16 text-muted-foreground" />
        <div className="space-y-2">
          <h3 className="font-medium">{t('No conversations yet')}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {t('Start a conversation by visiting someone\'s profile and clicking the message button.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.key}
          conversation={conv}
          onClick={() => handleConversationClick(conv)}
        />
      ))}
    </div>
  )
}

function ConversationItem({
  conversation,
  onClick
}: {
  conversation: TDmConversation
  onClick: () => void
}) {
  const timeAgo = dayjs.unix(conversation.lastMessageAt).fromNow()

  return (
    <button
      className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
      onClick={onClick}
    >
      <UserAvatar userId={conversation.pubkey} size="normal" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <Username
            userId={conversation.pubkey}
            className="font-medium truncate"
          />
          <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground truncate">
            {conversation.lastMessageContent}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="shrink-0 flex items-center justify-center h-5 min-w-[1.25rem] px-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

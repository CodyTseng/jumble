import Tabs from '@/components/Tabs'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { toDmConversation } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import { TDmConversation } from '@/types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

dayjs.extend(relativeTime)

type TDmTab = 'messages' | 'requests'

export default function DmList() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { push } = useSecondaryPage()
  const [conversations, setConversations] = useState<TDmConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TDmTab>('messages')

  const loadConversations = useCallback(async () => {
    if (!pubkey) return

    try {
      const convs = await dmService.getConversations(pubkey)
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

    const unsubscribe = dmService.onDataChanged(() => {
      loadConversations()
    })

    return () => {
      unsubscribe()
    }
  }, [pubkey, loadConversations])

  const filteredConversations = useMemo(() => {
    if (activeTab === 'messages') {
      return conversations.filter((c) => c.hasReplied)
    }
    return conversations.filter((c) => !c.hasReplied)
  }, [conversations, activeTab])

  const hasUnreadMessages = useMemo(() => {
    return conversations.some((c) => c.hasReplied && c.unreadCount > 0)
  }, [conversations])

  const hasUnreadRequests = useMemo(() => {
    return conversations.some((c) => !c.hasReplied && c.unreadCount > 0)
  }, [conversations])

  const handleConversationClick = (conv: TDmConversation) => {
    push(toDmConversation(conv.pubkey))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div>
      <Tabs
        tabs={[
          { value: 'messages', label: 'Messages', dot: hasUnreadMessages },
          { value: 'requests', label: 'Requests', dot: hasUnreadRequests }
        ]}
        value={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TDmTab)}
      />
      {filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
          <MessageSquare className="h-16 w-16 text-muted-foreground" />
          <div className="space-y-2">
            {activeTab === 'messages' ? (
              <>
                <h3 className="font-medium">{t('No conversations yet')}</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t(
                    "Start a conversation by visiting someone's profile and clicking the message button."
                  )}
                </p>
              </>
            ) : (
              <>
                <h3 className="font-medium">{t('No message requests')}</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t("Messages from people you haven't replied to will appear here.")}
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y">
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.key}
              conversation={conv}
              onClick={() => handleConversationClick(conv)}
            />
          ))}
        </div>
      )}
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
      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50"
      onClick={onClick}
    >
      <UserAvatar userId={conversation.pubkey} size="normal" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Username userId={conversation.pubkey} className="truncate font-medium" />
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">
            {conversation.lastMessageContent}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

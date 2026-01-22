import UserAvatar from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import dmMessageService from '@/services/dm-message.service'
import encryptionKeyService from '@/services/encryption-key.service'
import { TDmMessage } from '@/types'
import dayjs from 'dayjs'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DmMessageList({ otherPubkey }: { otherPubkey: string }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [messages, setMessages] = useState<TDmMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)

  const loadMessages = useCallback(async () => {
    if (!pubkey) return

    try {
      const msgs = await dmMessageService.getMessages(pubkey, otherPubkey, { limit: 50 })
      setMessages(msgs)
      setHasMore(msgs.length >= 50)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setIsLoading(false)
    }
  }, [pubkey, otherPubkey])

  const loadMoreMessages = useCallback(async () => {
    if (!pubkey || isLoadingMore || !hasMore || messages.length === 0) return

    setIsLoadingMore(true)
    try {
      const oldestMessage = messages[0]
      const olderMsgs = await dmMessageService.getMessages(pubkey, otherPubkey, {
        limit: 50,
        before: oldestMessage.createdAt
      })
      if (olderMsgs.length < 50) {
        setHasMore(false)
      }
      setMessages((prev) => [...olderMsgs, ...prev])
    } catch (error) {
      console.error('Failed to load more messages:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [pubkey, otherPubkey, messages, isLoadingMore, hasMore])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!pubkey) return

    dmMessageService.markConversationAsRead(pubkey, otherPubkey)
  }, [pubkey, otherPubkey])

  useEffect(() => {
    if (!pubkey) return

    const encryptionKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
    if (!encryptionKeypair) return

    const handleNewMessage = (message: TDmMessage) => {
      const conversationKey = dmMessageService.getConversationKey(pubkey, otherPubkey)
      if (message.conversationKey === conversationKey) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        dmMessageService.markConversationAsRead(pubkey, otherPubkey)
      }
    }

    const unsubscribe = dmMessageService.subscribeToMessages(
      pubkey,
      encryptionKeypair,
      handleNewMessage
    )

    return () => {
      unsubscribe()
    }
  }, [pubkey, otherPubkey])

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView()
      isInitialLoad.current = false
    }
  }, [messages])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const { scrollTop } = containerRef.current
    if (scrollTop < 100 && !isLoadingMore && hasMore) {
      loadMoreMessages()
    }
  }, [loadMoreMessages, isLoadingMore, hasMore])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <p className="text-muted-foreground">{t('No messages yet. Send one!')}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
      onScroll={handleScroll}
    >
      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {messages.map((message, index) => {
        const showAvatar =
          index === 0 || messages[index - 1].senderPubkey !== message.senderPubkey
        const showTime =
          index === 0 ||
          message.createdAt - messages[index - 1].createdAt > 300

        return (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.senderPubkey === pubkey}
            showAvatar={showAvatar}
            showTime={showTime}
          />
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showTime
}: {
  message: TDmMessage
  isOwn: boolean
  showAvatar: boolean
  showTime: boolean
}) {
  const time = dayjs.unix(message.createdAt).format('HH:mm')

  return (
    <div className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && (
        <div className="w-8 shrink-0">
          {showAvatar && <UserAvatar userId={message.senderPubkey} size="small" />}
        </div>
      )}
      <div
        className={cn('flex flex-col max-w-[75%]', isOwn ? 'items-end' : 'items-start')}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-2 break-words',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-secondary rounded-bl-md'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        {showTime && (
          <span className="text-xs text-muted-foreground mt-1 px-1">{time}</span>
        )}
      </div>
    </div>
  )
}

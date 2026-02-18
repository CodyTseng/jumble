import UserAvatar from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import { TDmMessage } from '@/types'
import dayjs from 'dayjs'
import { AlertCircle, Check, Clock, Loader2 } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DmMessageList({ otherPubkey }: { otherPubkey: string }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [messages, setMessages] = useState<TDmMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [, setStatusVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const lastMessageIdRef = useRef<string | null>(null)

  const loadMessages = useCallback(async () => {
    if (!pubkey) return

    try {
      const msgs = await dmService.getMessages(pubkey, otherPubkey, { limit: 50 })
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
      const olderMsgs = await dmService.getMessages(pubkey, otherPubkey, {
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

    dmService.markConversationAsRead(pubkey, otherPubkey)
  }, [pubkey, otherPubkey])

  useEffect(() => {
    if (!pubkey) return

    const conversationKey = dmService.getConversationKey(pubkey, otherPubkey)

    const unsubMessage = dmService.onNewMessage((message: TDmMessage) => {
      if (message.conversationKey === conversationKey) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        dmService.markConversationAsRead(pubkey, otherPubkey)
      }
    })

    const unsubData = dmService.onDataChanged(() => {
      loadMessages()
    })

    const unsubStatus = dmService.onSendingStatusChanged(() => {
      setStatusVersion((v) => v + 1)
    })

    return () => {
      unsubMessage()
      unsubData()
      unsubStatus()
    }
  }, [pubkey, otherPubkey, loadMessages])

  // Auto-scroll: on initial load, and when own new message is appended
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    if (isInitialLoad.current) {
      bottomRef.current?.scrollIntoView()
      isInitialLoad.current = false
    } else if (lastMessage.id !== lastMessageIdRef.current && lastMessage.senderPubkey === pubkey) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    lastMessageIdRef.current = lastMessage.id
  }, [messages, pubkey])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const { scrollTop } = containerRef.current
    if (scrollTop < 100 && !isLoadingMore && hasMore) {
      loadMoreMessages()
    }
  }, [loadMoreMessages, isLoadingMore, hasMore])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t('No messages yet. Send one!')}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 select-text overflow-y-auto p-4"
      onScroll={handleScroll}
    >
      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {messages.map((message, index) => {
        const isOwn = message.senderPubkey === pubkey
        const showTime = index === 0 || message.createdAt - messages[index - 1].createdAt > 300
        const nextShowTime =
          index < messages.length - 1 &&
          messages[index + 1].createdAt - message.createdAt > 300

        // Time breaks also break bubble grouping
        const isGroupStart =
          index === 0 ||
          messages[index - 1].senderPubkey !== message.senderPubkey ||
          showTime
        const isGroupEnd =
          index === messages.length - 1 ||
          messages[index + 1].senderPubkey !== message.senderPubkey ||
          nextShowTime

        return (
          <Fragment key={message.id}>
            {showTime && (
              <div className={cn('flex justify-center', index === 0 ? '' : 'mt-3')}>
                <span className="text-xs text-muted-foreground">
                  {dayjs.unix(message.createdAt).format('HH:mm')}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              isOwn={isOwn}
              isGroupStart={isGroupStart}
              isGroupEnd={isGroupEnd}
              sendingStatus={isOwn ? dmService.getSendingStatus(message.id) : undefined}
              className={showTime ? 'mt-1' : isGroupStart ? 'mt-3' : 'mt-0.5'}
            />
          </Fragment>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({
  message,
  isOwn,
  isGroupStart,
  isGroupEnd,
  sendingStatus,
  className
}: {
  message: TDmMessage
  isOwn: boolean
  isGroupStart: boolean
  isGroupEnd: boolean
  sendingStatus?: 'sending' | 'sent' | 'failed'
  className?: string
}) {
  const bubbleClass = isOwn
    ? cn(
        'break-words px-3 py-1 rounded-tl-md rounded-bl-md bg-primary text-primary-foreground',
        isGroupStart ? 'rounded-tr-md' : 'rounded-tr-[2px]',
        isGroupEnd && !isGroupStart ? 'rounded-br-md' : 'rounded-br-[2px]'
      )
    : cn(
        'break-words px-3 py-1 rounded-tr-md rounded-br-md bg-secondary',
        isGroupStart ? 'rounded-tl-md' : 'rounded-tl-[2px]',
        isGroupEnd && !isGroupStart ? 'rounded-bl-md' : 'rounded-bl-[2px]'
      )

  return (
    <div className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row', className)}>
      {!isOwn && (
        <div className="w-8 shrink-0">
          {isGroupStart && <UserAvatar userId={message.senderPubkey} size="small" />}
        </div>
      )}
      <div className={cn('flex min-w-0 max-w-[75%] flex-col', isOwn ? 'items-end' : 'items-start')}>
        <div className="flex min-w-0 max-w-full items-end gap-1">
          {sendingStatus && <SendingStatusIcon status={sendingStatus} />}
          <div className={bubbleClass}>
            <p className="select-text whitespace-pre-wrap break-all text-sm">{message.content}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SendingStatusIcon({ status }: { status: 'sending' | 'sent' | 'failed' }) {
  switch (status) {
    case 'sending':
      return <Clock className="h-3 w-3 text-muted-foreground" />
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />
  }
}
